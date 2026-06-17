import type { Cents } from "./money.js";
import type { EmployeePayoutContext } from "./payout.js";

/**
 * Types for the agent JUDGMENT layer — the LLM's advisory output. The LLM
 * interprets free-form HR text and reasons about anomalies; it NEVER authorizes
 * money. Everything here is a *proposal* that the deterministic layer (signed
 * mandate + contract) must still approve.
 */

export type DeltaKind =
  | "terminate"
  | "rate-change"
  | "bonus"
  | "base-change"
  | "no-op"
  | "unknown";

/** One change the agent extracted from a free-form HR update. */
export interface PayoutDelta {
  employeeId: string;
  displayName: string;
  kind: DeltaKind;
  /** Plain-language description of what the agent understood. */
  description: string;
  /** New pay-rate multiplier (rate-change). */
  newRate?: number;
  /** Bonus percentage applied to base (bonus). */
  bonusPct?: number;
  /** New base salary in cents (base-change). */
  newBaseCents?: Cents;
  /** Effective date if the update specified one (free text, e.g. "from the 15th"). */
  effectiveFrom?: string;
}

/** "Here's what I understood" — the reviewable diff against the roster. */
export interface HrUpdateInterpretation {
  rawText: string;
  deltas: PayoutDelta[];
  /** One-paragraph natural-language summary for the HR-intake UI. */
  summary: string;
  /** True when this came from the real LLM; false when from the deterministic mock. */
  fromLlm: boolean;
}

/** An anomaly the agent flagged. `halt` stops the line and escalates to a human. */
export interface AnomalyFlag {
  employeeId: string;
  displayName: string;
  severity: "halt" | "warn";
  /** Natural-language explanation written for a human reviewer + the ledger. */
  reason: string;
  baselineCents?: Cents;
  proposedCents?: Cents;
  deviationPct?: number;
  accountChanged?: boolean;
}

/** Per-line decision the agent produced for the cycle. */
export interface PayoutLineDecision {
  context: EmployeePayoutContext;
  anomaly?: AnomalyFlag;
  status: "ready" | "halted-escalated";
}

/** The full proposal the agent presents before any disbursement runs. */
export interface PayrollProposal {
  cycleId: string;
  interpretation: HrUpdateInterpretation;
  lines: PayoutLineDecision[];
  /** Sum of READY lines only (halted lines are excluded from dispatch). */
  totalCents: Cents;
  /** Did the ready total stay within the signed mandate ceiling? */
  withinCeiling: boolean;
  ceilingCents: Cents;
  /** Lines that were halted and escalated to a human. */
  escalations: AnomalyFlag[];
}
