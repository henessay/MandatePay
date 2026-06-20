import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  getAddress,
  defineChain,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type DisbursementRail,
  type DisbursementInstruction,
  type DispatchReceipt,
} from "@mandatepay/shared";

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
]);

/** The agent holds a public wallet address — no PII — rendered as this placeholder. */
export const WALLET_PLACEHOLDER = "{{wallet}}";

export interface EvmRailConfig {
  rpcUrl: string;
  chainId: number;
  /** Treasury EOA private key (server-side, .env only). Pays the salaries. */
  treasuryKey: Hex;
  /** ERC-20 token address; omit to pay the chain's native coin. */
  tokenAddress?: Address;
  /** Token decimals (default 6 for the ERC-20 path, 18 for native). */
  tokenDecimals?: number;
  /** Multiply the USD salary before converting to token units (default 1). */
  amountScale?: number;
  /** e.g. https://sepolia.etherscan.io/tx/ — for UI links. */
  explorerTxBase?: string;
}

/**
 * Convert a USD cents amount to integer token base units, using integer math to
 * avoid float drift. `scale` (may be fractional) shrinks demo amounts so a run
 * doesn't drain the treasury, e.g. scale 0.001: $6,200 -> 6.2 mUSD.
 */
export function centsToTokenUnits(amountCents: number, decimals: number, scale = 1): bigint {
  const scaledCents = BigInt(Math.max(0, Math.round(amountCents * scale)));
  const pow = 10n ** BigInt(decimals);
  return (scaledCents * pow) / 100n;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/**
 * Factory whose INFERRED return type captures the exact account/chain-bound viem
 * client types — so the class can store them without the generic-default mismatch
 * you get from `ReturnType<typeof createWalletClient>`.
 */
function makeClients(cfg: EvmRailConfig) {
  const account = privateKeyToAccount(cfg.treasuryKey);
  const chain = defineChain({
    id: cfg.chainId,
    name: `chain-${cfg.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  return { account, chain, wallet, pub };
}

/**
 * Real on-chain disbursement rail. The agent (autonomously, under the signed
 * mandate) sends each ready payout from the treasury to the employee's wallet —
 * an ERC-20 transfer (default) or the native coin. Returns the real tx hash;
 * transfers are broadcast sequentially so nonces increment without waiting for
 * each to mine. Selected by MANDATEPAY_RAIL=evm.
 */
export class EvmRail implements DisbursementRail {
  readonly kind = "evm" as const;

  private readonly cfg: EvmRailConfig;
  private readonly c: ReturnType<typeof makeClients>;
  private readonly decimals: number;

  constructor(cfg: EvmRailConfig) {
    this.cfg = cfg;
    this.c = makeClients(cfg);
    this.decimals = cfg.tokenDecimals ?? (cfg.tokenAddress ? 6 : 18);
  }

  /** Treasury wallet address (for display / balance checks). */
  get treasuryAddress(): Address {
    return this.c.account.address;
  }

  async treasuryTokenBalance(): Promise<bigint> {
    if (!this.cfg.tokenAddress) return this.c.pub.getBalance({ address: this.c.account.address });
    return this.c.pub.readContract({
      address: this.cfg.tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [this.c.account.address],
    });
  }

  async dispatch(instruction: DisbursementInstruction): Promise<DispatchReceipt> {
    const now = Date.now();
    let to: Address;
    try {
      to = getAddress(instruction.recipientRef);
    } catch {
      return reject(instruction, now, `recipientRef "${instruction.recipientRef}" is not a wallet address`);
    }

    const units = centsToTokenUnits(instruction.amountCents, this.decimals, this.cfg.amountScale ?? 1);
    try {
      const txHash: Hex = this.cfg.tokenAddress
        ? await this.c.wallet.writeContract({
            address: this.cfg.tokenAddress,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [to, units],
          })
        : await this.c.wallet.sendTransaction({ to, value: units });

      return {
        status: "dispatched",
        railRef: txHash,
        resolvedAccountMasked: shortAddr(to),
        placeholderUsed: WALLET_PLACEHOLDER,
        amountCents: instruction.amountCents,
        currency: instruction.currency,
        txHash,
        dispatchedAtMs: now,
      };
    } catch (e) {
      return reject(instruction, now, e instanceof Error ? e.message : String(e), to);
    }
  }
}

function reject(
  instruction: DisbursementInstruction,
  now: number,
  reason: string,
  to?: string,
): DispatchReceipt {
  return {
    status: "rejected",
    railRef: `evm_rej_${instruction.nonce.slice(2, 10)}`,
    resolvedAccountMasked: to ? shortAddr(to) : "—",
    placeholderUsed: WALLET_PLACEHOLDER,
    amountCents: instruction.amountCents,
    currency: instruction.currency,
    txHash: null,
    dispatchedAtMs: now,
    reason,
  };
}

/** Build EvmRailConfig from env, or null if the required vars are absent. */
export function evmRailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EvmRailConfig | null {
  const rpcUrl = env.EVM_RPC_URL;
  const treasuryKey = env.EVM_TREASURY_KEY;
  if (!rpcUrl || !treasuryKey) return null;
  return {
    rpcUrl,
    chainId: Number(env.EVM_CHAIN_ID ?? 11155111),
    treasuryKey: (treasuryKey.startsWith("0x") ? treasuryKey : `0x${treasuryKey}`) as Hex,
    tokenAddress: env.EVM_TOKEN_ADDRESS ? (getAddress(env.EVM_TOKEN_ADDRESS) as Address) : undefined,
    tokenDecimals: env.EVM_TOKEN_DECIMALS ? Number(env.EVM_TOKEN_DECIMALS) : undefined,
    amountScale: env.EVM_AMOUNT_SCALE ? Number(env.EVM_AMOUNT_SCALE) : 1,
    explorerTxBase: env.EVM_EXPLORER_TX_BASE ?? "https://sepolia.etherscan.io/tx/",
  };
}
