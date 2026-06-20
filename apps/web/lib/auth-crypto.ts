import "server-only";
import { recoverEip191Address as recover } from "@mandatepay/agent";

/**
 * EIP-191 (personal_sign) recovery, wrapped to return null on any malformed input
 * instead of throwing. Goes through @mandatepay/agent so the T3N SDK stays behind
 * the agent boundary (web → agent → SDK). Returns a lowercase 0x address.
 */
export function recoverEip191Address(message: string, signatureHex: string): string | null {
  try {
    return recover(message, signatureHex);
  } catch {
    return null;
  }
}

/** Recover the signer over raw bytes (used for the mandate's JCS credential). */
export function recoverEip191AddressBytes(message: Uint8Array, signatureHex: string): string | null {
  try {
    return recover(message, signatureHex);
  } catch {
    return null;
  }
}
