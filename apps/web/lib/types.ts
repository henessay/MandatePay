import type {
  SignedMandate,
  RosterEmployee,
  PayrollProposal,
  LedgerEvent,
  DispatchReceipt,
  AttestationStatus,
} from "@mandatepay/shared";

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

/** The canonical demo HR update — client-safe default for the textarea. */
export const DEFAULT_HR_UPDATE =
  "Boris Ivanov left the company, Carol Petrov is on 0.5 rate from the 15th, sales team gets a 10% bonus";
