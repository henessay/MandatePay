import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { eth_get_address, ethRecoverEip191 } from "@terminal3/t3n-sdk";

/**
 * Key helpers for MandatePay. Two roles:
 *  - CFO: holds a 32-byte secp256k1 secret (an EOA). In production the TEE holds
 *    this custodially; offline we use a throwaway EOA. Used to sign the mandate.
 *  - Agent: holds its own 32-byte secret; its 33-byte COMPRESSED public key is
 *    baked into the delegation credential so only this agent can invoke it.
 *
 * (The SDK has no helper to derive a compressed agent pubkey — see FEEDBACK_T3.md #7 —
 * so we wrap @noble/curves here once.)
 */

export interface Keypair {
  secret: Uint8Array; // 32 bytes
  /** 33-byte compressed secp256k1 public key. */
  pubkeyCompressed: Uint8Array;
}

/** Generate a fresh secp256k1 keypair with a valid scalar. */
export function generateKeypair(): Keypair {
  const secret = secp256k1.utils.randomSecretKey();
  return { secret, pubkeyCompressed: secp256k1.getPublicKey(secret, true) };
}

/** Build a keypair from an existing 0x-prefixed (or bare) hex secret. */
export function keypairFromHex(hex: string): Keypair {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const secret = hexToBytes(clean);
  if (secret.length !== 32) {
    throw new Error(`expected a 32-byte secret, got ${secret.length} bytes`);
  }
  return { secret, pubkeyCompressed: secp256k1.getPublicKey(secret, true) };
}

export function toHex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

/** Ethereum address (0x, lowercase) for an EOA secret — delegates to the SDK. */
export function ethAddressFromSecret(secret: Uint8Array): string {
  return eth_get_address("0x" + bytesToHex(secret));
}

/**
 * Recover the EIP-191 (personal_sign) signer of a message, as a lowercase 0x
 * address. Accepts the message as raw bytes (e.g. the credential JCS) or a UTF-8
 * string (e.g. a SIWE login message). Same primitive the mandate-verify path uses,
 * so a browser-wallet personal_sign and our server verification agree byte-for-byte.
 */
export function recoverEip191Address(message: Uint8Array | string, signatureHex: string): string {
  const msg = typeof message === "string" ? new TextEncoder().encode(message) : message;
  const sig = hexToBytes(signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex);
  return ("0x" + bytesToHex(ethRecoverEip191(msg, sig))).toLowerCase();
}
