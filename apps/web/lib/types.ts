import type {
  SignedMandate,
  RosterEmployee,
  PayrollProposal,
  LedgerEvent,
  DispatchReceipt,
  AttestationStatus,
} from "@mandatepay/shared";

/**
 * The dashboard's visual flow. Signing is a deliberate gate before the run;
 * "running" splits into parse → dispatch micro-states for the demo, then "done".
 */
export type Phase = "idle" | "signing" | "signed" | "running" | "done" | "error";

/** Client-safe shape returned by POST /api/cycle (no server-only imports here). */
export interface CycleResponse {
  mandate: SignedMandate;
  mandateVerified: boolean;
  roster: RosterEmployee[];
  proposal: PayrollProposal;
  receipts: { employeeId: string; receipt: DispatchReceipt }[];
  ledger: LedgerEvent[];
  dispatched: boolean;
  attestation: AttestationStatus;
  railKind: string;
  llmKind: string;
}

/** The canonical demo HR update (English) — client-safe default for the textarea. */
export const DEFAULT_HR_UPDATE =
  "Boris Ivanov left the company, Carol Petrov is on 0.5 rate from the 15th, sales team gets a 10% bonus";

/** The same instruction in free-form Russian — the multilingual trump card. */
export const DEMO_HR_UPDATE_RU =
  "Борис Иванов уволился; Кэрол Петрова с 15-го числа переходит на 0.5 ставки; отделу sales — премия 10%";

/**
 * The bounds the CFO is about to sign, shown BEFORE the cycle runs. These mirror
 * `buildDemoMandate()`'s defaults 1:1 (packages/agent/src/fixtures.ts), so the
 * terms on screen are exactly what the server signs — the real EIP-191 signature,
 * vc_id and signer address are revealed once /api/cycle returns.
 */
export const DEMO_MANDATE_CONFIG = {
  ceilingCents: 50_000_00,
  individualThresholdCents: 15_000_00,
  windowDays: 30,
  contract: "tee:payroll",
  currency: "SGD" as const,
  recipients: [
    { displayName: "Alice Tan", team: "sales" },
    { displayName: "Boris Ivanov", team: "engineering" },
    { displayName: "Carol Petrov", team: "engineering" },
    { displayName: "Dinesh Kumar", team: "sales" },
    { displayName: "Emma Lim", team: "sales" },
  ],
} as const;

/**
 * Header attestation state before a cycle has run. Honest "mock" (offline build):
 * the badge reads as a green "Valid" in the T3 style but is explicitly labelled
 * mock — we never paint an un-attested enclave as verified.
 */
export const DEFAULT_ATTESTATION: AttestationStatus = {
  state: "mock",
  source: "offline-mock",
  checkedAtMs: 0,
  note: "Offline build — TDX attestation not yet wired. On a live node this badge reflects a real enclave measurement (RTMR3).",
};
