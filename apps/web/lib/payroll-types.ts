import type { HrUpdateInterpretation, LedgerEvent, AnomalyFlag } from "@mandatepay/shared";

/** One employee's payout outcome for the UI (client-safe). */
export interface PayoutRow {
  employeeId: string;
  displayName: string;
  team: string;
  /** Recipient wallet (0x). */
  wallet: string;
  amountCents: number;
  /** "dispatched" | "rejected" | "halted-escalated" | "pending". */
  status: string;
  /** On-chain tx hash when dispatched. */
  txHash?: string | null;
  reason?: string | null;
}

/** Result of POST /api/payroll/run (client-safe). */
export interface RunResult {
  instruction: string;
  interpretation: HrUpdateInterpretation;
  rows: PayoutRow[];
  totalCents: number;
  ceilingCents: number;
  withinCeiling: boolean;
  dispatched: boolean;
  ledger: LedgerEvent[];
  railKind: string;
  /** Treasury address (EVM rail), else null. */
  treasury?: string | null;
  /** e.g. https://sepolia.etherscan.io/tx/ — append a tx hash for the link. */
  explorerTxBase: string;
  escalations: AnomalyFlag[];
}
