import type {
  Cents,
  RosterEmployee,
  SignedMandate,
  PayoutDelta,
  AnomalyFlag,
  PayoutLineDecision,
  PayrollProposal,
  HrUpdateInterpretation,
} from "@mandatepay/shared";
import { buildPayoutContext } from "../payout.js";

export const DEFAULT_ANOMALY_DEVIATION_PCT = 300;

export interface ComputeArgs {
  cycleId: string;
  roster: RosterEmployee[];
  deltas: PayoutDelta[];
  mandate: SignedMandate;
  interpretation: HrUpdateInterpretation;
  /** Per-employee previous-cycle net (cents) — the anomaly baseline. */
  baselines?: Record<string, Cents>;
  /** Deviation threshold vs baseline that triggers a halt (percent). Default 300. */
  anomalyDeviationPct?: number;
}

interface AppliedDeltas {
  rate: number;
  baseSalaryCents: Cents;
  bonusCents: Cents;
  terminated: boolean;
}

/** Fold all deltas for one employee into effective pay parameters (deterministic). */
function applyDeltas(emp: RosterEmployee, deltas: PayoutDelta[]): AppliedDeltas {
  let rate = emp.rate;
  let baseSalaryCents = emp.baseSalaryCents;
  let bonusCents = 0;
  let terminated = emp.employmentStatus === "terminated";

  for (const d of deltas.filter((x) => x.employeeId === emp.employeeId)) {
    switch (d.kind) {
      case "terminate":
        terminated = true;
        break;
      case "rate-change":
        if (typeof d.newRate === "number") rate = d.newRate;
        break;
      case "base-change":
        if (typeof d.newBaseCents === "number") baseSalaryCents = d.newBaseCents;
        break;
      case "bonus":
        if (typeof d.bonusPct === "number") {
          bonusCents += Math.round(baseSalaryCents * (d.bonusPct / 100));
        }
        break;
      default:
        break; // no-op / unknown: leave unchanged for human review
    }
  }
  return { rate, baseSalaryCents, bonusCents, terminated };
}

/** Deterministic anomaly evaluation. Returns a halt/warn flag or undefined. */
function evaluateAnomaly(
  emp: RosterEmployee,
  amountCents: Cents,
  mandate: SignedMandate,
  baseline: Cents | undefined,
  deviationPct: number,
): AnomalyFlag | undefined {
  // 1) Account changed recently — always halt and escalate.
  if (emp.bankAccountChangedRecently) {
    return {
      employeeId: emp.employeeId,
      displayName: emp.displayName,
      severity: "halt",
      reason: `Bank account for ${emp.displayName} changed recently — halting and escalating to a human to confirm the new destination before any payout.`,
      proposedCents: amountCents,
      accountChanged: true,
    };
  }

  // 2) Deviation beyond threshold vs the historical baseline — halt and escalate.
  if (baseline !== undefined && baseline > 0) {
    const dev = ((amountCents - baseline) / baseline) * 100;
    if (dev > deviationPct) {
      return {
        employeeId: emp.employeeId,
        displayName: emp.displayName,
        severity: "halt",
        reason: `Proposed payout for ${emp.displayName} is ${dev.toFixed(0)}% above the historical norm (baseline ${baseline}¢ → proposed ${amountCents}¢), beyond the ${deviationPct}% threshold — halting for human review.`,
        baselineCents: baseline,
        proposedCents: amountCents,
        deviationPct: Math.round(dev),
      };
    }
  }

  // 3) Above the CFO's signed per-line threshold — halt and escalate.
  if (amountCents > mandate.terms.individualThresholdCents) {
    return {
      employeeId: emp.employeeId,
      displayName: emp.displayName,
      severity: "halt",
      reason: `Proposed payout for ${emp.displayName} (${amountCents}¢) exceeds the CFO's signed per-line threshold (${mandate.terms.individualThresholdCents}¢) — halting for human review.`,
      proposedCents: amountCents,
    };
  }

  return undefined;
}

/**
 * The deterministic core. Takes the agent's interpreted deltas (advisory) and
 * produces a fully-decided payroll proposal: per-line amounts, anomaly halts,
 * the ready total, and whether it stays within the CFO's signed ceiling. The LLM
 * does not appear here — by the time we compute money, everything is deterministic.
 */
export function computeProposal(args: ComputeArgs): PayrollProposal {
  const deviationPct = args.anomalyDeviationPct ?? DEFAULT_ANOMALY_DEVIATION_PCT;
  const baselines = args.baselines ?? {};
  const lines: PayoutLineDecision[] = [];
  const escalations: AnomalyFlag[] = [];
  let readyTotal = 0;

  for (const emp of args.roster) {
    const applied = applyDeltas(emp, args.deltas);
    if (applied.terminated) {
      // Terminated employees produce no payout line at all.
      continue;
    }

    const amountCents =
      Math.round(applied.baseSalaryCents * applied.rate) + applied.bonusCents;

    const anomaly = evaluateAnomaly(
      emp,
      amountCents,
      args.mandate,
      baselines[emp.employeeId],
      deviationPct,
    );

    const ctx = buildPayoutContext({
      employee: emp,
      amountCents,
      mandateVcId: args.mandate.terms.vcId,
      note: anomaly?.reason,
    });

    if (anomaly && anomaly.severity === "halt") {
      escalations.push(anomaly);
      lines.push({ context: ctx, anomaly, status: "halted-escalated" });
    } else {
      readyTotal += amountCents;
      lines.push({ context: ctx, ...(anomaly ? { anomaly } : {}), status: "ready" });
    }
  }

  return {
    cycleId: args.cycleId,
    interpretation: args.interpretation,
    lines,
    totalCents: readyTotal,
    withinCeiling: readyTotal <= args.mandate.terms.ceilingCents,
    ceilingCents: args.mandate.terms.ceilingCents,
    escalations,
  };
}
