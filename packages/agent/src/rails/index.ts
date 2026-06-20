import {
  railSelectorFromEnv,
  type DisbursementRail,
  type RailSelector,
} from "@mandatepay/shared";
import { MockStripeRail } from "./mockStripe.js";
import { T3PayrollRail, type PayrollExecuteClient } from "./t3Payroll.js";
import { EvmRail, evmRailConfigFromEnv, type EvmRailConfig } from "./evm.js";

export { MockStripeRail } from "./mockStripe.js";
export { T3PayrollRail, type PayrollExecuteClient } from "./t3Payroll.js";
export {
  EvmRail,
  evmRailConfigFromEnv,
  centsToTokenUnits,
  WALLET_PLACEHOLDER,
  type EvmRailConfig,
} from "./evm.js";
export { FIXTURE_VAULT, resolveAccount, maskAccount } from "./vault.js";

export interface CreateRailOptions {
  /** Required only when selecting the live `t3-payroll` rail. */
  t3?: { client: PayrollExecuteClient; scriptVersion?: string };
  /** Config for the on-chain `evm` rail (else read from env in createRailFromEnv). */
  evm?: EvmRailConfig;
}

/**
 * Factory: pick the rail from a selector (default mock). Flipping
 * `MANDATEPAY_RAIL=t3-payroll` or `=evm` is the ONLY change needed to go live —
 * provided the rail's config/client is supplied.
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
  if (selector === "evm") {
    if (!options.evm) {
      throw new Error(
        "createRail('evm') requires EvmRailConfig — set EVM_RPC_URL + EVM_TREASURY_KEY (and EVM_TOKEN_ADDRESS), or pass options.evm.",
      );
    }
    return new EvmRail(options.evm);
  }
  return new MockStripeRail();
}

/**
 * Convenience: build the rail straight from `MANDATEPAY_RAIL`. For the `evm`
 * rail the config is read from env (EVM_*). If `evm` is selected but not
 * configured, falls back to the offline mock so the app never hard-crashes.
 */
export function createRailFromEnv(
  env: string | undefined,
  options: CreateRailOptions = {},
): DisbursementRail {
  const selector = railSelectorFromEnv(env);
  if (selector === "evm" && !options.evm) {
    const cfg = evmRailConfigFromEnv();
    return cfg ? new EvmRail(cfg) : new MockStripeRail();
  }
  return createRail(selector, options);
}
