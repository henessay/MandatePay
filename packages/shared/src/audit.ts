import type { Cents, Currency } from "./money.js";

/**
 * App-level audit ledger event. Mirrors the T3N SDK's host-stamped `AuditEvent`
 * (subject/actor/vc_id are stamped by the host from verified dispatch context —
 * a contract cannot forge who acted or on whom). On a live node these come from
 * `getAuditEvents`; offline we emit identically-shaped events so the UI is real.
 *
 * Integrity is positioned honestly (no invented client-side Merkle proof):
 * immutable host-stamped batches + `txHash` + TDX attestation (the badge).
 */
export interface LedgerEvent {
  /** Stable id for UI keys / dedup. */
  id: string;
  tsMs: number;
  /** The user whose data the call touched (host-stamped pii_did). */
  subject: string;
  /** The agent (delegated) or user (self) who acted (host-stamped). */
  actor: string;
  /** Delegation credential id on a delegated call; null on a self-call. */
  vcId: string | null;
  /** What happened, e.g. "payout.dispatch", "payout.halt", "mandate.sign". */
  action: string;
  /** What it acted on, e.g. employeeId or "mandate". */
  target: string;
  /** Result, e.g. "success" | "denied" | "halted". */
  outcome: "success" | "denied" | "halted" | "escalated";
  /** Free-text / JSON detail — the agent's plain-language justification. */
  details?: string | null;
  /** Ledger tx reference when present. */
  txHash?: string | null;
  /** Did the emitting dispatch commit? false => the outcome is a claim, not durable. */
  committed: boolean;
  /** Optional amount context for ledger rows that move money. */
  amountCents?: Cents;
  currency?: Currency;
}

/** TDX attestation status surfaced by the UI badge. */
export interface AttestationStatus {
  /** "verified" only when a real enclave quote checks out; "mock" when offline. */
  state: "verified" | "mock" | "unverified" | "error";
  /** RTMR3 measurement (hex) when available. */
  rtmr3?: string;
  /** Node/peer this attestation came from. */
  source?: string;
  checkedAtMs: number;
  note?: string;
}
