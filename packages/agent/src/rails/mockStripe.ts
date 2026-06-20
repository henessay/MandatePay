import {
  ACCOUNT_PLACEHOLDER,
  type DisbursementRail,
  type DisbursementInstruction,
  type DispatchReceipt,
} from "@mandatepay/shared";
import { FIXTURE_VAULT, resolveAccount, maskAccount } from "./vault.js";

/**
 * Offline rail that faithfully mimics the `http-with-placeholders` boundary on
 * OUR side. The agent hands us an opaque `recipientRef` + the literal
 * `{{account}}` placeholder; the substitution to a real account happens HERE,
 * inside the rail (standing in for the TEE), and the real account is never
 * returned — only a masked form for the UI.
 *
 * This is the default rail (`MANDATEPAY_RAIL=mock`) and powers the whole demo
 * with zero network.
 */
export class MockStripeRail implements DisbursementRail {
  readonly kind = "mock-stripe" as const;

  constructor(private readonly vault: Readonly<Record<string, string>> = FIXTURE_VAULT) {}

  async dispatch(instruction: DisbursementInstruction): Promise<DispatchReceipt> {
    const now = Date.now();

    // Wallet-style recipientRef (0x address): the org/EVM model pays public
    // wallets, not opaque bank refs. Offline we "dispatch" to a masked address
    // with a deterministic fake tx so the demo works without a live chain.
    if (/^0x[0-9a-fA-F]{40}$/.test(instruction.recipientRef)) {
      return {
        status: "dispatched",
        railRef: `mock_evm_${instruction.nonce.slice(0, 10)}`,
        resolvedAccountMasked: `••••${instruction.recipientRef.slice(-4)}`,
        placeholderUsed: ACCOUNT_PLACEHOLDER,
        amountCents: instruction.amountCents,
        currency: instruction.currency,
        txHash: `0xmock${instruction.nonce.slice(0, 24)}`,
        dispatchedAtMs: now,
      };
    }

    const real = resolveAccount(instruction.recipientRef, this.vault);

    if (real === null) {
      return {
        status: "rejected",
        railRef: `mock_rej_${instruction.nonce.slice(0, 8)}`,
        resolvedAccountMasked: "—",
        placeholderUsed: ACCOUNT_PLACEHOLDER,
        amountCents: instruction.amountCents,
        currency: instruction.currency,
        txHash: null,
        dispatchedAtMs: now,
        reason: `unknown recipientRef "${instruction.recipientRef}" — no vault entry`,
      };
    }

    // The placeholder substitution, made explicit and inspectable. The agent-built
    // request carries ONLY the placeholder; the real account is injected here.
    const requestTemplate = {
      destination_account: ACCOUNT_PLACEHOLDER,
      amount_cents: instruction.amountCents,
      currency: instruction.currency,
      idempotency_key: instruction.nonce,
    };
    const dispatched = JSON.parse(
      JSON.stringify(requestTemplate).replaceAll(ACCOUNT_PLACEHOLDER, real),
    ) as typeof requestTemplate;

    // Sanity: the dispatched request resolved the placeholder to the real account,
    // but we surface only the masked form upward.
    const resolvedAccountMasked = maskAccount(dispatched.destination_account);

    return {
      status: "dispatched",
      railRef: `mock_tr_${instruction.nonce.slice(0, 10)}`,
      resolvedAccountMasked,
      placeholderUsed: ACCOUNT_PLACEHOLDER,
      amountCents: instruction.amountCents,
      currency: instruction.currency,
      // Deterministic fake ledger ref so the UI has something stable to render offline.
      txHash: `0xmock${instruction.nonce.slice(0, 24)}`,
      dispatchedAtMs: now,
    };
  }
}
