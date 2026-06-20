import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { getOrg } from "@/lib/org-store";
import { rosterFromOrg, computeCeilingCents } from "@/lib/org-roster";
import {
  buildDemoMandate,
  createLlmClient,
  createRailFromEnv,
  runPayrollCycle,
  DEMO_AGENT_DID,
  EvmRail,
} from "@mandatepay/agent";
import type { RunResult, PayoutRow } from "@/lib/payroll-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report which rail a run would use (so the UI can label it before running). */
export async function GET() {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ railKind: createRailFromEnv(process.env.MANDATEPAY_RAIL).kind });
}

/**
 * Run one payroll cycle over the caller's organisation: interpret the
 * instruction (LLM, advisory), enforce the mandate bounds (deterministic), and
 * dispatch ready lines through the configured rail — the EVM rail sends real
 * mUSD to each employee wallet. Returns per-wallet outcomes + tx hashes.
 */
export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const org = await getOrg(owner);
  const roster = org ? rosterFromOrg(org) : [];
  if (!org || roster.length === 0) {
    return NextResponse.json({ error: "add active employees before running payroll" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { instruction?: unknown };
  const instruction =
    typeof body.instruction === "string" && body.instruction.trim()
      ? body.instruction.trim()
      : "Run this month's payroll for the whole team.";

  const ceilingCents = computeCeilingCents(roster);
  const { mandate } = buildDemoMandate({ ceilingCents, individualThresholdCents: ceilingCents });
  const rail = createRailFromEnv(process.env.MANDATEPAY_RAIL);
  const llm = createLlmClient(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL);
  const baselines = Object.fromEntries(roster.map((e) => [e.employeeId, e.baseSalaryCents]));

  const result = await runPayrollCycle({
    cycleId: `run-${Date.now()}`,
    rawHrUpdate: instruction,
    roster,
    mandate,
    rail,
    llm,
    agentActorDid: DEMO_AGENT_DID,
    baselines,
  });

  const walletById = new Map(org.employees.map((e) => [e.employeeId, e.wallet]));
  const teamById = new Map(org.employees.map((e) => [e.employeeId, e.team]));
  const receiptById = new Map(result.receipts.map((r) => [r.employeeId, r.receipt]));

  const rows: PayoutRow[] = result.proposal.lines.map((line) => {
    const r = receiptById.get(line.context.employeeId);
    return {
      employeeId: line.context.employeeId,
      displayName: line.context.displayName,
      team: teamById.get(line.context.employeeId) ?? "",
      wallet: walletById.get(line.context.employeeId) ?? line.context.recipientRef,
      amountCents: line.context.amountCents,
      status: line.status === "ready" ? (r?.status ?? "pending") : "halted-escalated",
      txHash: r?.txHash ?? null,
      reason: r?.reason ?? line.anomaly?.reason ?? null,
    };
  });

  const out: RunResult = {
    instruction,
    interpretation: result.proposal.interpretation,
    rows,
    totalCents: result.proposal.totalCents,
    ceilingCents: result.proposal.ceilingCents,
    withinCeiling: result.proposal.withinCeiling,
    dispatched: result.dispatched,
    ledger: result.ledger,
    railKind: rail.kind,
    treasury: rail instanceof EvmRail ? rail.treasuryAddress : null,
    explorerTxBase: process.env.EVM_EXPLORER_TX_BASE || "https://sepolia.etherscan.io/tx/",
    escalations: result.proposal.escalations,
  };
  return NextResponse.json(out);
}
