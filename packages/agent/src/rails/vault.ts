/**
 * Rail-internal account vault (MOCK side only).
 *
 * This is the ONLY place real account numbers exist in the offline build. It is
 * rail-internal — nothing here is ever returned to the agent, the shared types,
 * or the UI except in MASKED form. On the live rail this mapping lives inside the
 * TEE and we never see it at all. Keeping it in its own module makes the trust
 * boundary obvious: the agent holds `acct_ref_*`; only the vault resolves it.
 */

export interface VaultEntry {
  recipientRef: string;
  /** A realistic-looking real account number — deliberately IBAN/PAN-shaped so the
   *  zero-PII guard would reject it if it ever leaked onto the agent context. */
  realAccount: string;
}

/** Demo fixture vault. Keys are the opaque refs the agent holds. */
export const FIXTURE_VAULT: Readonly<Record<string, string>> = Object.freeze({
  acct_ref_alice: "SG21DBSS01234567890123",
  acct_ref_bob: "DE89370400440532013000",
  acct_ref_carol: "GB82WEST12345698765432",
  acct_ref_dinesh: "FR1420041010050500013M02606",
  acct_ref_emma: "4242424242424242",
});

/** Resolve an opaque ref to a real account (rail-internal). */
export function resolveAccount(
  recipientRef: string,
  vault: Readonly<Record<string, string>> = FIXTURE_VAULT,
): string | null {
  return vault[recipientRef] ?? null;
}

/** Mask a real account for display: keep the last 4, hide the rest. */
export function maskAccount(real: string): string {
  const alnum = real.replace(/[^A-Za-z0-9]/g, "");
  const last4 = alnum.slice(-4);
  return `•••• ${last4}`;
}
