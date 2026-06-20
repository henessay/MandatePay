import { describe, it, expect } from "vitest";
import { centsToTokenUnits, evmRailConfigFromEnv, EvmRail } from "./evm.js";

describe("centsToTokenUnits", () => {
  it("converts USD cents to 6-decimal token units at scale 1", () => {
    // $6,200.00 -> 6200 mUSD (6 decimals)
    expect(centsToTokenUnits(620000, 6, 1)).toBe(6_200_000_000n);
  });

  it("applies a fractional demo scale", () => {
    // scale 0.001: $6,200 -> 6.2 mUSD
    expect(centsToTokenUnits(620000, 6, 0.001)).toBe(6_200_000n);
  });

  it("handles 18-decimal native units and zero", () => {
    expect(centsToTokenUnits(100, 18, 1)).toBe(10n ** 18n); // $1.00
    expect(centsToTokenUnits(0, 6, 1)).toBe(0n);
  });
});

describe("evmRailConfigFromEnv", () => {
  it("returns null without the required vars", () => {
    expect(evmRailConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("parses config and applies Sepolia defaults", () => {
    const cfg = evmRailConfigFromEnv({
      EVM_RPC_URL: "https://rpc.example",
      EVM_TREASURY_KEY: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      EVM_TOKEN_ADDRESS: "0x6a68cc677c6bd10a39d3733ea519ca093c32a5a1",
    } as NodeJS.ProcessEnv);
    expect(cfg).not.toBeNull();
    expect(cfg!.chainId).toBe(11155111);
    expect(cfg!.amountScale).toBe(1);
    expect(cfg!.treasuryKey.startsWith("0x")).toBe(true);
    expect(cfg!.explorerTxBase).toContain("sepolia.etherscan.io");
  });
});

describe("EvmRail", () => {
  it("derives the treasury address from the key (viem, no network)", () => {
    const rail = new EvmRail({
      rpcUrl: "https://rpc.example",
      chainId: 11155111,
      treasuryKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      tokenAddress: "0x6a68Cc677c6bd10a39d3733Ea519ca093C32a5A1",
    });
    expect(rail.kind).toBe("evm");
    // Well-known key/address pair (anvil account 0).
    expect(rail.treasuryAddress).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });
});
