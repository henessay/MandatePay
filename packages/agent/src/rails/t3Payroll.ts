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
  /** Resolved `tee:payroll` script version, or "latest". */
  scriptVersion?: string;
}

/**
 * LIVE rail — calls `execute-disbursement` on `tee:payroll`. The placeholder
 * substitution (`bank_account_ref → real account`) happens SERVER-SIDE inside
 * the TEE; we only ever send the opaque ref and receive masked/reference data.
 *
 * ⚠️ TODO(live-node, R1): the exact `function_name`, the `input` shape, and the
 * decoded response are NOT confirmed offline (the SDK ships no fixture for them —
 * see docs/PHASE1_PLAN.md §3 and FEEDBACK_T3.md #4). Everything below the
 * "WIRE FORMAT — UNCONFIRMED" line is a thin best-effort mapping to be verified
 * against a live node and corrected in one place. Until then this rail throws a
 * clear, actionable error rather than guessing silently.
 */
export class T3PayrollRail implements DisbursementRail {
  readonly kind = "t3-payroll" as const;

  constructor(private readonly opts: T3PayrollRailOpts) {}

  async dispatch(instruction: DisbursementInstruction): Promise<DispatchReceipt> {
    const now = Date.now();

    // ---- request the agent sends (zero-PII: opaque ref + placeholder only) ----
    const payload = {
      script_name: "tee:payroll",
      script_version: this.opts.scriptVersion ?? "latest",
      function_name: "execute-disbursement", // TODO(R1): confirm against live tee:payroll
      input: {
        cycle_id: instruction.cycleId,
        employee_id: instruction.employeeId,
        recipient_ref: instruction.recipientRef, // resolved INSIDE the TEE, never here
        amount_cents: instruction.amountCents,
        currency: instruction.currency,
        mandate_vc_id: instruction.mandateVcId,
        nonce: instruction.nonce,
      },
    };

    const raw = await this.opts.client.executeAndDecode<Record<string, unknown>>(payload);

    // ===================== WIRE FORMAT — UNCONFIRMED ==========================
    // TODO(R1): replace this block once we have a real response from the node.
    // Map the contract's decoded response into our DispatchReceipt. Field names
    // below are PLACEHOLDERS based on the SDK's general conventions, not verified.
    const status = (raw["status"] as string | undefined) ?? undefined;
    const txHash =
      (raw["tx_hash"] as string | undefined) ?? (raw["txHash"] as string | undefined) ?? null;
    const masked =
      (raw["resolved_account_masked"] as string | undefined) ??
      (raw["account_masked"] as string | undefined);

    if (status === undefined || masked === undefined) {
      throw new Error(
        "T3PayrollRail: unconfirmed tee:payroll response shape (R1). Got keys: " +
          Object.keys(raw).join(", ") +
          ". Confirm the wire format against a live node and update this mapping.",
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
