import {
  ACCOUNT_PLACEHOLDER,
  type DisbursementRail,
  type DisbursementInstruction,
  type DispatchReceipt,
} from "@mandatepay/shared";

/**
 * Structural seam for the authenticated T3n client this rail dispatches through.
 * Kept minimal (not the concrete `T3nClient`) so we don't pull WASM/node into
 * offline builds and tests. The real client is wired in `apps/web` server-side.
 */
export interface PayrollExecuteClient {
  executeAndDecode<T = unknown>(payload: unknown): Promise<T>;
}

export interface T3PayrollRailOpts {
  client: PayrollExecuteClient;
  /**
   * CONCRETE resolved semver of `tee:payroll/contracts` (live value at audit
   * time: "5.2.0"). MUST NOT be "latest": confirmed live (FEEDBACK #27) that the
   * contract registry only resolves the `/contracts`-suffixed name and `execute`
   * cannot parse a literal "latest". Resolve caller-side with
   * `getScriptVersion(baseUrl, "tee:payroll/contracts")` and pass the result.
   */
  scriptVersion?: string;
}

/**
 * Executable script name. CONFIRMED live (FEEDBACK #27): the *logical* contract
 * name `tee:payroll` — the one written into the delegation credential and into
 * org-data grants — is NOT the executable script name. Execution dispatches
 * against `tee:payroll/contracts`; `getScriptVersion("tee:payroll")` 404s.
 */
const PAYROLL_SCRIPT_NAME = "tee:payroll/contracts";

/**
 * LIVE rail — dispatches `execute-disbursement` on `tee:payroll/contracts`. The
 * placeholder substitution (`bank_account_ref → real account`) happens
 * SERVER-SIDE inside the TEE; we only ever send the opaque ref and receive
 * masked/reference data.
 *
 * R1 status (verified against testnet 2026-06-18):
 *   ✅ script_name = `tee:payroll/contracts`, NOT `tee:payroll`            (#27)
 *   ✅ script_version must be a concrete semver (live 5.2.0); "latest" 404s (#27)
 *   ✅ amounts cross the wire as DECIMAL STRINGS — `executeAndDecode` cannot
 *      JSON-serialize the SDK's `bigint` request fields                    (#29)
 *   ✅ the contract is RUN-oriented (compute-payroll takes a whole-run
 *      `PayrollRunRequest`); authorization needs an org-data grant on the
 *      logical `tee:payroll`, which needs an organisation + seeded policy +
 *      roster — none creatable from the client SDK                         (#30)
 *   ⛔️ STILL UNCONFIRMED (blocked on organisation provisioning, PHASE1_PLAN §3):
 *      the exact `execute-disbursement` input (per-line vs run-scoped) and its
 *      decoded RESPONSE shape. The mapping below is a best-effort PLACEHOLDER;
 *      until a live response is captured the rail THROWS rather than guess.
 */
export class T3PayrollRail implements DisbursementRail {
  readonly kind = "t3-payroll" as const;

  constructor(private readonly opts: T3PayrollRailOpts) {
    if (!opts.scriptVersion || opts.scriptVersion === "latest") {
      throw new Error(
        `T3PayrollRail: scriptVersion must be a concrete semver (e.g. "5.2.0"), got ` +
          `"${opts.scriptVersion ?? "undefined"}". A literal "latest" does not resolve for the ` +
          `built-in tee: contracts (FEEDBACK #27) — resolve it via ` +
          `getScriptVersion(baseUrl, "${PAYROLL_SCRIPT_NAME}") and pass the result.`,
      );
    }
  }

  async dispatch(instruction: DisbursementInstruction): Promise<DispatchReceipt> {
    const now = Date.now();

    // ---- request the agent sends (zero-PII: opaque ref + placeholder only) ----
    const payload = {
      script_name: PAYROLL_SCRIPT_NAME, // confirmed (#27)
      script_version: this.opts.scriptVersion, // concrete semver, confirmed required (#27)
      function_name: "execute-disbursement", // UNCONFIRMED input shape — see class doc
      input: {
        cycle_id: instruction.cycleId,
        employee_id: instruction.employeeId,
        recipient_ref: instruction.recipientRef, // resolved INSIDE the TEE, never here
        amount_cents: String(instruction.amountCents), // decimal string on the wire (#29)
        currency: instruction.currency,
        mandate_vc_id: instruction.mandateVcId,
        nonce: instruction.nonce,
      },
    };

    const raw = await this.opts.client.executeAndDecode<Record<string, unknown>>(payload);

    // ===================== WIRE FORMAT — RESPONSE UNCONFIRMED =================
    // TODO(R1): replace once a live execute-disbursement response is captured.
    // Field names below are PLACEHOLDERS based on the SDK's general conventions;
    // the contract is run-oriented so the real response may be batch-shaped.
    const status = (raw["status"] as string | undefined) ?? undefined;
    const txHash =
      (raw["tx_hash"] as string | undefined) ?? (raw["txHash"] as string | undefined) ?? null;
    const masked =
      (raw["resolved_account_masked"] as string | undefined) ??
      (raw["account_masked"] as string | undefined);

    if (status === undefined || masked === undefined) {
      throw new Error(
        "T3PayrollRail: execute-disbursement response shape is UNCONFIRMED (R1, blocked on " +
          "organisation provisioning — FEEDBACK #30). Got keys: [" +
          Object.keys(raw).join(", ") +
          "]. Capture a live response and finalize this mapping in one place.",
      );
    }

    return {
      status: status === "dispatched" ? "dispatched" : status === "halted" ? "halted" : "rejected",
      railRef: (raw["rail_ref"] as string | undefined) ?? `t3_${instruction.nonce.slice(0, 10)}`,
      resolvedAccountMasked: masked,
      placeholderUsed: ACCOUNT_PLACEHOLDER,
      amountCents: instruction.amountCents,
      currency: instruction.currency,
      txHash,
      dispatchedAtMs: now,
      ...(raw["reason"] ? { reason: String(raw["reason"]) } : {}),
    };
    // ==========================================================================
  }
}
