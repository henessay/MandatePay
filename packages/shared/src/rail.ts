import type { DisbursementInstruction, DispatchReceipt } from "./payout.js";

/**
 * The single seam that isolates "needs a live node" from everything else.
 * Two implementations live in `packages/agent`: `MockStripeRail` (offline,
 * default) and `T3PayrollRail` (calls `execute-disbursement` on `tee:payroll`).
 * Selected by the `MANDATEPAY_RAIL` env var. Flipping rails must change nothing
 * else in the app, agent, or UI.
 */
export interface DisbursementRail {
  readonly kind: "mock-stripe" | "t3-payroll" | "evm";
  /** Resolve the opaque recipientRef to a real account INSIDE the rail/TEE and dispatch. */
  dispatch(instruction: DisbursementInstruction): Promise<DispatchReceipt>;
}

export type RailSelector = "mock" | "t3-payroll" | "evm";

/** Normalize the env value into a selector (defaults to offline mock). */
export function railSelectorFromEnv(value: string | undefined): RailSelector {
  if (value === "t3-payroll") return "t3-payroll";
  if (value === "evm") return "evm";
  return "mock";
}
