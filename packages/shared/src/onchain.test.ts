import { describe, it, expect } from "vitest";
import { recipientRefToAddress, mandateIdFromVcId, nonceToBytes32 } from "./onchain.js";

describe("on-chain mirror helpers (zero-PII)", () => {
  it("derives a deterministic address from the opaque ref (matches Solidity keccak last-20)", () => {
    // Pinned vector == address(uint160(uint256(keccak256("acct_ref_alice")))).
    expect(recipientRefToAddress("acct_ref_alice")).toBe(
      "0x904ba97b24181e7387012367bb6232c36c4a3c48",
    );
    expect(recipientRefToAddress("acct_ref_alice")).toBe(recipientRefToAddress("acct_ref_alice"));
    expect(recipientRefToAddress("acct_ref_alice")).not.toBe(recipientRefToAddress("acct_ref_bob"));
    expect(recipientRefToAddress("acct_ref_ghost")).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("does NOT leak the ref (or any account string) into the derived address", () => {
    const ref = "acct_ref_alice";
    // The address is a hash: it cannot contain the ref, and a real account is never an input.
    expect(recipientRefToAddress(ref).toLowerCase()).not.toContain(ref.toLowerCase());
    expect(recipientRefToAddress("DE89370400440532013000")).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("mandateIdFromVcId is a deterministic 32-byte hex (0x-prefix + case insensitive)", () => {
    const id = mandateIdFromVcId("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(mandateIdFromVcId("0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4")).toBe(id);
  });

  it("nonceToBytes32 left-pads a hex nonce to 32 bytes", () => {
    expect(nonceToBytes32("00112233445566778899aabbccddeeff")).toBe(
      "0x" + "00112233445566778899aabbccddeeff".padStart(64, "0"),
    );
    expect(nonceToBytes32("0xff")).toMatch(/^0x0{62}ff$/);
  });
});
