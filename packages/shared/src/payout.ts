import type { Cents, Currency } from "./money.js";

/**
 * The agent's working context for a single payout line.
 *
 * ZERO-PII BY CONSTRUCTION: this type has NO field for a real account number,
 * IBAN, PAN, or routing number. The only account locator is `recipientRef`, an
 * opaque token (`acct_ref_…`). You physically cannot place a real account number
 * on this object without a type error — and `assertNoRawAccount` (see guards.ts)
 * additionally fails loudly at runtime if a real-account-shaped string sneaks in
 * via the open-ended `note` field or anywhere else.
 *
 * The split-screen UI's LEFT pane renders exactly this object.
 */
export interface EmployeePayoutContext {
  employeeId: string;
  displayName: string;
  team: string;
  /** OPAQUE reference. NOT a real account number. Rendered as `{{account}}` in the UI. */
  recipientRef: string;
  /** Computed payout for this cycle, integer cents. */
  amountCents: Cents;
  currency: Currency;
  /** The delegation credential id (vc_id, hex) this payout is bound to. */
  mandateVcId: string;
  /** Optional free-text justification from the agent (never PII — guarded). */
  note?: string;
}

/**
 * The literal placeholder token the agent "sees" in place of the resolved
 * account. Substitution to the real account happens only inside the rail/TEE.
 */
export const ACCOUNT_PLACEHOLDER = "{{account}}";

/** What the agent hands a `DisbursementRail`. Still zero-PII: carries `recipientRef`. */
export interface DisbursementInstruction {
  cycleId: string;
  employeeId: string;
  recipientRef: string;
  amountCents: Cents;
  currency: Currency;
  mandateVcId: string;
  /** Per-disbursement nonce — replay protection (also enforced on-chain). */
  nonce: string;
}

/** What a rail returns after dispatch. The masked account is for display only. */
export interface DispatchReceipt {
  status: "dispatched" | "halted" | "rejected";
  /** Rail-side reference (Stripe id / tee tx ref). */
  railRef: string;
  /** Masked resolved account for the UI's RIGHT pane, e.g. "•••• 4242". Never full. */
  resolvedAccountMasked: string;
  /** The placeholder the agent saw — proves the substitution boundary. */
  placeholderUsed: string;
  amountCents: Cents;
  currency: Currency;
  /** Ledger reference when present. */
  txHash?: string | null;
  dispatchedAtMs: number;
  /** Reason when status is "halted" / "rejected". */
  reason?: string;
}
