import {
  railSelectorFromEnv,
  type DisbursementRail,
  type RailSelector,
} from "@mandatepay/shared";
import { MockStripeRail } from "./mockStripe.js";
import { T3PayrollRail, type PayrollExecuteClient } from "./t3Payroll.js";

export { MockStripeRail } from "./mockStripe.js";
export { T3PayrollRail, type PayrollExecuteClient } from "./t3Payroll.js";
export { FIXTURE_VAULT, resolveAccount, maskAccount } from "./vault.js";

export interface CreateRailOptions {
  /** Required only when selecting the live `t3-payroll` rail. */
  t3?: { client: PayrollExecuteClient; scriptVersion?: string };
}

/**
 * Factory: pick the rail from a selector (default mock). Flipping
 * `MANDATEPAY_RAIL=t3-payroll` is the ONLY change needed to go live — provided
 * an authenticated client is supplied.
 */
export function createRail(selector: RailSelector, options: CreateRailOptions = {}): DisbursementRail {
  if (selector === "t3-payroll") {
    if (!options.t3) {
      throw new Error(
        "createRail('t3-payroll') requires an authenticated T3n client (see docs/PHASE1_PLAN.md §3).",
      );
    }
    return new T3PayrollRail(options.t3);
  }
  return new MockStripeRail();
}

/** Convenience: build the rail straight from `process.env.MANDATEPAY_RAIL`. */
export function createRailFromEnv(
  env: string | undefined,
  options: CreateRailOptions = {},
): DisbursementRail {
  return createRail(railSelectorFromEnv(env), options);
}
