import type { Cents, Currency } from "./money.js";

/**
 * Roster employee as MandatePay stores it. Mirrors the spirit of the T3N SDK's
 * `EmployeeRecord`: the disbursement target is an OPAQUE reference
 * (`bankAccountRef`), never a real account number. The real account lives only
 * in the rail's vault (mock) or inside the TEE (live) — never here, and never
 * on the agent's working context (see `EmployeePayoutContext`).
 */
export interface RosterEmployee {
  employeeId: string;
  /** Display name is fine to show — it is not a sensitive account locator. */
  displayName: string;
  /** Team/department — used by HR updates like "sales team gets a 10% bonus". */
  team: string;
  employmentStatus: "active" | "terminated";
  /** Monthly gross base salary, integer cents. */
  baseSalaryCents: Cents;
  /** Pay-rate multiplier, e.g. 1.0 full-time, 0.5 half rate. */
  rate: number;
  currency: Currency;
  /**
   * OPAQUE disbursement reference — the ONLY account locator MandatePay holds.
   * Format `acct_ref_<token>`; deliberately contains no real-account digit runs.
   */
  bankAccountRef: string;
  /** Anomaly signal mirrored from the SDK's `bank_account_changed_recently`. */
  bankAccountChangedRecently: boolean;
}

/** The roster the CFO's mandate covers. */
export interface Roster {
  orgId: string;
  employees: RosterEmployee[];
}
