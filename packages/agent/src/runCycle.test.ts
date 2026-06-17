import { describe, it, expect } from "vitest";
import { assertNoRawAccount } from "@mandatepay/shared";
import { runPayrollCycle } from "./runCycle.js";
import { MockStripeRail } from "./rails/mockStripe.js";
import { MockLlmClient } from "./judgment/llm.js";
import {
  buildDemoMandate,
  DEMO_EMPLOYEES,
  DEMO_BASELINES,
  DEMO_HR_UPDATE,
  DEMO_AGENT_DID,
} from "./fixtures.js";

function run(overrides: Partial<Parameters<typeof runPayrollCycle>[0]> = {}) {
  const { mandate } = buildDemoMandate();
  return runPayrollCycle({
    cycleId: "cycle-2026-06",
    rawHrUpdate: DEMO_HR_UPDATE,
    roster: DEMO_EMPLOYEES,
    mandate,
    rail: new MockStripeRail(),
    llm: new MockLlmClient(),
    agentActorDid: DEMO_AGENT_DID,
    baselines: DEMO_BASELINES,
    ...overrides,
  });
}

describe("runPayrollCycle (offline, mock rails)", () => {
  it("interprets the canonical HR update into deltas", async () => {
    const { proposal } = await run();
    const kinds = proposal.interpretation.deltas.map((d) => d.kind).sort();
    // Boris terminated, Carol rate-change, sales (Alice/Dinesh/Emma) bonus x3
    expect(kinds).toContain("terminate");
    expect(kinds).toContain("rate-change");
    expect(kinds.filter((k) => k === "bonus").length).toBe(3);
  });

  it("drops the terminated employee and halts the account-changed one", async () => {
    const { proposal } = await run();
    const ids = proposal.lines.map((l) => l.context.employeeId);
    expect(ids).not.toContain("emp_boris"); // terminated -> no line
    const emma = proposal.lines.find((l) => l.context.employeeId === "emp_emma");
    expect(emma?.status).toBe("halted-escalated");
    expect(proposal.escalations.some((e) => e.accountChanged)).toBe(true);
  });

  it("computes Carol's 0.5-rate payout deterministically", async () => {
    const { proposal } = await run();
    const carol = proposal.lines.find((l) => l.context.employeeId === "emp_carol");
    expect(carol?.context.amountCents).toBe(450_000); // 900_000 * 0.5
  });

  it("dispatches ready lines and stays within the ceiling", async () => {
    const { proposal, receipts, dispatched } = await run();
    expect(dispatched).toBe(true);
    expect(proposal.withinCeiling).toBe(true);
    // Alice (880k), Carol (450k), Dinesh (770k) dispatched; Emma halted; Boris gone.
    expect(receipts.map((r) => r.employeeId).sort()).toEqual(
      ["emp_alice", "emp_carol", "emp_dinesh"].sort(),
    );
    expect(receipts.every((r) => r.receipt.status === "dispatched")).toBe(true);
  });

  it("refuses to dispatch when the ready total exceeds the signed ceiling", async () => {
    const { mandate } = buildDemoMandate({ ceilingCents: 1_000_00 }); // SGD 1,000 — far too low
    const res = await runPayrollCycle({
      cycleId: "cycle-tiny",
      rawHrUpdate: DEMO_HR_UPDATE,
      roster: DEMO_EMPLOYEES,
      mandate,
      rail: new MockStripeRail(),
      llm: new MockLlmClient(),
      agentActorDid: DEMO_AGENT_DID,
      baselines: DEMO_BASELINES,
    });
    expect(res.dispatched).toBe(false);
    expect(res.proposal.withinCeiling).toBe(false);
    expect(res.ledger.some((e) => e.action === "cycle.deny")).toBe(true);
    expect(res.receipts.length).toBe(0);
  });

  it("the ENTIRE cycle result is zero-PII (no real account anywhere)", async () => {
    const res = await run();
    expect(() => assertNoRawAccount(res)).not.toThrow();
  });
});
