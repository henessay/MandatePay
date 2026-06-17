import {
  assertNoRawAccount,
  type RosterEmployee,
  type EmployeePayoutContext,
  type DisbursementInstruction,
} from "@mandatepay/shared";

/**
 * Build the agent's working context for one payout line — and assert zero-PII on
 * the way out. By construction the context only carries `recipientRef` (the
 * opaque `bankAccountRef`); the runtime guard is the backstop against a real
 * account number sneaking in via the free-text `note`.
 */
export function buildPayoutContext(args: {
  employee: RosterEmployee;
  amountCents: number;
  mandateVcId: string;
  note?: string;
}): EmployeePayoutContext {
  const { employee, amountCents, mandateVcId, note } = args;
  const ctx: EmployeePayoutContext = {
    employeeId: employee.employeeId,
    displayName: employee.displayName,
    team: employee.team,
    recipientRef: employee.bankAccountRef,
    amountCents,
    currency: employee.currency,
    mandateVcId,
    ...(note ? { note } : {}),
  };
  assertNoRawAccount(ctx); // throws RawAccountLeakError if a real account shape appears
  return ctx;
}

/** Turn a zero-PII payout context into a rail instruction. Guarded again. */
export function toInstruction(
  ctx: EmployeePayoutContext,
  cycleId: string,
  nonce: string,
): DisbursementInstruction {
  const instruction: DisbursementInstruction = {
    cycleId,
    employeeId: ctx.employeeId,
    recipientRef: ctx.recipientRef,
    amountCents: ctx.amountCents,
    currency: ctx.currency,
    mandateVcId: ctx.mandateVcId,
    nonce,
  };
  assertNoRawAccount(instruction);
  return instruction;
}

/** Per-disbursement nonce (hex). Replay protection — also enforced on-chain. */
export function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
