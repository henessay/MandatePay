import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * On-chain mirror helpers + the optional second-trust-root seam.
 *
 * The on-chain `MandatePolicy` mirror allowlists recipients by Ethereum ADDRESS,
 * but the agent only ever holds an OPAQUE `bank_account_ref`. These helpers derive
 * a deterministic address from the ref ALONE — the real bank account never enters
 * the derivation — so the on-chain allowlist mirrors the mandate without leaking PII.
 */

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const strip0x = (h: string): string => (h.startsWith("0x") ? h.slice(2) : h);

/**
 * Deterministic, zero-PII recipient address for the on-chain mirror allowlist,
 * derived ONLY from the opaque `bank_account_ref`.
 *
 * Byte-for-byte equivalent to Solidity's
 * `address(uint160(uint256(keccak256(bytes(ref)))))` — the last 20 bytes of
 * `keccak256(ref)`. The CFO seeds `createMandate` with these addresses and the
 * agent computes the same address at dispatch; the real account is never involved.
 */
export function recipientRefToAddress(ref: string): `0x${string}` {
  return ("0x" + bytesToHex(keccak_256(utf8(ref)).slice(12))) as `0x${string}`;
}

/** `bytes32` mandate id for the on-chain mirror, derived from the mandate's `vc_id` (hex). */
export function mandateIdFromVcId(vcIdHex: string): `0x${string}` {
  return ("0x" + bytesToHex(keccak_256(utf8(strip0x(vcIdHex).toLowerCase())))) as `0x${string}`;
}

/** `bytes32` nonce for the on-chain mirror, from a hex disbursement nonce (left-padded). */
export function nonceToBytes32(nonceHex: string): `0x${string}` {
  return ("0x" + strip0x(nonceHex).toLowerCase().padStart(64, "0")) as `0x${string}`;
}

/** Input to the on-chain mirror's `authorizeDisbursement` re-check. */
export interface OnChainAuthorizeInput {
  mandateId: `0x${string}`;
  recipientAddress: `0x${string}`;
  amountCents: number;
  nonceBytes32: `0x${string}`;
}

export type OnChainAuthorizeResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: string };

/**
 * Optional SECOND trust root: re-enforces the mandate bounds on a public chain
 * (`MandatePolicy.authorizeDisbursement`) before the rail dispatches. Injected into
 * the payout path; when absent (offline default) the on-chain step is skipped and
 * the TEE-signed bounds still hold. Non-load-bearing by design — if the chain is
 * down the agent still cannot exceed the mandate, but when it's up a payout must
 * satisfy BOTH the signed credential and the on-chain mirror.
 */
export interface OnChainMirror {
  readonly kind: "mandate-policy";
  authorize(input: OnChainAuthorizeInput): Promise<OnChainAuthorizeResult>;
}
