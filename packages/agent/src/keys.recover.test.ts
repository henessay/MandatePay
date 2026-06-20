import { describe, it, expect } from "vitest";
import { signCredential } from "@terminal3/t3n-sdk";
import { keypairFromHex, ethAddressFromSecret, recoverEip191Address } from "./keys.js";

/**
 * The SIWE login + real wallet mandate signing both rely on EIP-191 recovery
 * agreeing with what a wallet's personal_sign produces. This pins the primitive:
 * sign bytes with the SDK (the same path MetaMask uses on the wire) and recover
 * the signer back, both as raw bytes and via the UTF-8 string overload.
 */
describe("recoverEip191Address", () => {
  const secretHex = "0x" + "a1".repeat(32);
  const { secret } = keypairFromHex(secretHex);
  const expected = ethAddressFromSecret(secret).toLowerCase();

  function sigHexFor(message: Uint8Array): string {
    const { sig } = signCredential(message, secret);
    return "0x" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("round-trips raw message bytes back to the signer", () => {
    const msg = new TextEncoder().encode("MandatePay wants you to sign in\nNonce: abc123");
    expect(recoverEip191Address(msg, sigHexFor(msg))).toBe(expected);
  });

  it("recovers the same signer from the UTF-8 string overload", () => {
    const text = "MandatePay wants you to sign in\nNonce: zzz999";
    const sigHex = sigHexFor(new TextEncoder().encode(text));
    expect(recoverEip191Address(text, sigHex)).toBe(expected);
  });

  it("does not recover the signer for a tampered message", () => {
    const sigHex = sigHexFor(new TextEncoder().encode("original"));
    expect(recoverEip191Address("tampered", sigHex)).not.toBe(expected);
  });
});
