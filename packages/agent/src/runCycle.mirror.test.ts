import { describe, it, expect } from "vitest";
import { recipientRefToAddress, type OnChainMirror } from "@mandatepay/shared";
import { MockLlmClient } from "./judgment/llm.js";
import { createRail } from "./rails/index.js";
import { runPayrollCycle } from "./runCycle.js";
import {
  DEMO_EMPLOYEES,
  DEMO_BASELINES,
  DEMO_AGENT_DID,
  DEMO_HR_UPDATE,
  buildDemoMandate,
} from "./fixtures.js";

describe("runPayrollCycle — on-chain mirror gates dispatch (second trust root)", () => {
  it("blocks a line the contract rejects, dispatches the rest", async () => {
    const { mandate } = buildDemoMandate();
    const aliceAddr = recipientRefToAddress("acct_ref_alice").toLowerCase();
    const consulted: string[] = [];

    const mirror: OnChainMirror = {
      kind: "mandate-policy",
      async authorize(input) {
        consulted.push(input.recipientAddress.toLowerCase());
        // The contract rejects Alice (e.g. over per-line cap); everyone else clears.
        return input.recipientAddress.toLowerCase() === aliceAddr
          ? { ok: false, reason: "LineCapExceeded" }
          : { ok: true, txHash: "0xmock" + input.nonceBytes32.slice(2, 10) };
      },
    };

    const result = await runPayrollCycle({
      cycleId: "mirror-test",
      rawHrUpdate: DEMO_HR_UPDATE,
      roster: DEMO_EMPLOYEES,
      mandate,
      rail: createRail("mock"),
      llm: new MockLlmClient(),
      agentActorDid: DEMO_AGENT_DID,
      baselines: DEMO_BASELINES,
      mirror,
    });

    const dispatched = result.receipts.map((r) => r.employeeId);
    // On-chain rejection → Alice NOT dispatched; other ready lines still go through.
    expect(dispatched).not.toContain("emp_alice");
    expect(dispatched).toContain("emp_carol");
    expect(dispatched).toContain("emp_dinesh");
    expect(consulted).toContain(aliceAddr); // mirror was consulted before dispatch

    const deny = result.ledger.find(
      (e) => e.action === "payout.onchain-deny" && e.target === "emp_alice",
    );
    expect(deny?.outcome).toBe("denied");
    const auth = result.ledger.filter((e) => e.action === "payout.onchain-authorize");
    expect(auth.length).toBeGreaterThanOrEqual(2);
    expect(auth.every((e) => typeof e.txHash === "string")).toBe(true);
  });

  it("with NO mirror wired, behaves identically (offline default)", async () => {
    const { mandate } = buildDemoMandate();
    const result = await runPayrollCycle({
      cycleId: "no-mirror",
      rawHrUpdate: DEMO_HR_UPDATE,
      roster: DEMO_EMPLOYEES,
      mandate,
      rail: createRail("mock"),
      llm: new MockLlmClient(),
      agentActorDid: DEMO_AGENT_DID,
      baselines: DEMO_BASELINES,
    });
    expect(result.receipts.map((r) => r.employeeId)).toContain("emp_alice");
    expect(result.ledger.some((e) => e.action.startsWith("payout.onchain"))).toBe(false);
  });
});
