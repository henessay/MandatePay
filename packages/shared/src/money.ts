/**
 * Money is always integer cents. We never use floats for amounts — payout math
 * must be exact and match the on-chain / contract cents convention.
 */
export type Cents = number;

export type Currency = "SGD" | "USD";

/** Render integer cents as a human string, e.g. 2592000 -> "25,920.00". */
export function formatCents(cents: Cents, currency: Currency = "SGD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const grouped = whole.toLocaleString("en-US");
  return `${sign}${currency} ${grouped}.${frac}`;
}

/** Parse a human amount like "5,000" or "5000.50" into integer cents. */
export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}
