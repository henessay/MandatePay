import type {
  RosterEmployee,
  SignedMandate,
  DisbursementRail,
  LedgerEvent,
  PayrollProposal,
  DispatchReceipt,
  Cents,
} from "@mandatepay/shared";
import type { LlmClient } from "./judgment/llm.js";
import { interpretHrUpdate } from "./judgment/interpret.js";
import { computeProposal } from "./judgment/compute.js";
import { toInstruction, newNonce } from "./payout.js";
import { dispatchEvent, escalationEvent, ceilingDeniedEvent } from "./ledger.js";
import { isMandateActive } from "./mandate.js";

export interface RunCycleArgs {
  cycleId: string;
  rawHrUpdate: string;
  roster: RosterEmployee[];
  mandate: SignedMandate;
  rail: DisbursementRail;
  llm: LlmClient;
  /** `did:t3n:` of the agent — the delegated actor stamped on ledger events. */
  agentActorDid: string;
  baselines?: Record<string, Cents>;
  anomalyDeviationPct?: number;
  nowSecs?: number;
}

export interface CycleResult {
  proposal: PayrollProposal;
  receipts: { employeeId: string; receipt: DispatchReceipt }[];
  ledger: LedgerEvent[];
  /** True only when the cycle actually dispatched (within ceiling + mandate active). */
  dispatched: boolean;
}

/**
 * End-to-end cycle: interpret the HR update (LLM, advisory) → compute the
 * proposal (deterministic) → enforce mandate bounds → dispatch ready lines via
 * the rail → emit ledger events. The deterministic layer is the gate: if the
 * ready total exceeds the signed ceiling, or the mandate window is closed, the
 * agent refuses to dispatch and records the denial. The LLM never authorizes.
 */
export async function runPayrollCycle(args: RunCycleArgs): Promise<CycleResult> {
  const nowSecs = args.nowSecs ?? Math.floor(Date.now() / 1000);
  const ledger: LedgerEvent[] = [];
  const receipts: CycleResult["receipts"] = [];

  const interpretation = await interpretHrUpdate(args.llm, args.rawHrUpdate, args.roster);
  const proposal = computeProposal({
    cycleId: args.cycleId,
    roster: args.roster,
    deltas: interpretation.deltas,
    mandate: args.mandate,
    interpretation,
    ...(args.baselines ? { baselines: args.baselines } : {}),
    ...(args.anomalyDeviationPct !== undefined
      ? { anomalyDeviationPct: args.anomalyDeviationPct }
      : {}),
  });

  // Always record escalations (halted lines) — they are real agent decisions.
  for (const flag of proposal.escalations) {
    ledger.push(escalationEvent(args.mandate, args.agentActorDid, flag));
  }

  // Deterministic gates that block dispatch entirely.
  const mandateActive = isMandateActive(args.mandate, nowSecs);
  if (!mandateActive || !proposal.withinCeiling) {
    if (!proposal.withinCeiling) {
      ledger.push(ceilingDeniedEvent(args.mandate, args.agentActorDid, proposal.totalCents));
    }
    if (!mandateActive) {
      ledger.push({
        id: `evt_window_${Date.now().toString(36)}`,
        tsMs: Date.now(),
        subject: args.mandate.terms.orgDid,
        actor: args.agentActorDid,
        vcId: args.mandate.terms.vcId,
        action: "cycle.deny",
        target: "mandate.window",
        outcome: "denied",
        details: "Mandate is outside its signed validity window — the agent refused to dispatch.",
        txHash: null,
        committed: true,
      });
    }
    return { proposal, receipts, ledger, dispatched: false };
  }

  // Dispatch ready lines through the rail.
  for (const line of proposal.lines) {
    if (line.status !== "ready") continue;
    const instruction = toInstruction(line.context, args.cycleId, newNonce());
    const receipt = await args.rail.dispatch(instruction);
    receipts.push({ employeeId: line.context.employeeId, receipt });
    ledger.push(dispatchEvent(args.mandate, args.agentActorDid, line, receipt));
  }

  return { proposal, receipts, ledger, dispatched: true };
}
