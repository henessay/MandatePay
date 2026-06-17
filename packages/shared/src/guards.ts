/**
 * Runtime zero-PII guard.
 *
 * The agent's data model has no field for a real account number (type-level
 * guarantee). This module is the runtime backstop: it scans an object for any
 * string that LOOKS like a real bank account number (IBAN / PAN / long account
 * or routing digit-run) and throws loudly if found. Wire it into the payout
 * path so a real account number can never silently ride along (e.g. via an
 * open-ended `note` field or a future refactor).
 */

export class RawAccountLeakError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: string,
    public readonly sample: string,
  ) {
    super(
      `Zero-PII violation at "${path}": ${reason}. ` +
        `A real-account-shaped value reached the agent context (sample: "${sample}"). ` +
        `The agent must only ever hold an opaque recipientRef.`,
    );
    this.name = "RawAccountLeakError";
  }
}

const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/;

// A standalone numeric account/PAN token: a run of 12–19 digits delimited by
// NON-alphanumeric boundaries. The boundary requirement is what stops false
// positives on hex identifiers (nonces, tx hashes, vc ids), where a digit run is
// flanked by hex letters and is therefore part of an identifier, not an account.
const STANDALONE_DIGIT_RE = /(?<![A-Za-z0-9])\d{12,19}(?![A-Za-z0-9])/;
const PAN_RE = /(?<![A-Za-z0-9])\d{13,19}(?![A-Za-z0-9])/;

/** Luhn check — real card PANs pass it; random digit runs usually don't. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Returns a human reason string if `value` looks like a real account number,
 * else null. Tuned to NOT flag MandatePay's own opaque refs (`acct_ref_<hex>`),
 * employee ids, small amounts, hex hashes broken by non-digits, etc.
 */
export function looksLikeRealAccount(value: string): string | null {
  // Collapse common separators used in printed account/card numbers, then test.
  const compact = value.replace(/[\s-]/g, "");

  // Test IBAN on the original (word-delimited IBANs in prose) AND the compacted
  // form (IBANs printed in spaced groups).
  if (IBAN_RE.test(value) || IBAN_RE.test(compact)) return "matches IBAN format";

  // A standalone digit token of 13–19 that passes Luhn is almost certainly a card PAN.
  const panMatch = compact.match(PAN_RE);
  if (panMatch && passesLuhn(panMatch[0])) return "13–19 digit Luhn-valid PAN";

  // A standalone 12–19 digit numeric token is treated as a bank account number.
  // (Hex ids/nonces/hashes don't qualify: their digit runs are flanked by hex letters.)
  if (STANDALONE_DIGIT_RE.test(compact)) return "12–19 digit standalone account number";

  return null;
}

/**
 * Recursively assert that nothing in `obj` looks like a real account number.
 * Throws {@link RawAccountLeakError} on the first offender.
 */
export function assertNoRawAccount(obj: unknown, path = "$"): void {
  if (typeof obj === "string") {
    const reason = looksLikeRealAccount(obj);
    if (reason) {
      const sample = obj.length > 24 ? obj.slice(0, 24) + "…" : obj;
      throw new RawAccountLeakError(path, reason, sample);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => assertNoRawAccount(v, `${path}[${i}]`));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      assertNoRawAccount(v, `${path}.${k}`);
    }
  }
}
