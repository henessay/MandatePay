import "server-only";
import {
  buildDemoMandate,
  verifyMandate,
  runPayrollCycle,
  MockStripeRail,
  createLlmClient,
  DEMO_EMPLOYEES,
  DEMO_BASELINES,
  DEMO_HR_UPDATE,
  DEMO_AGENT_DID,
} from "@mandatepay/agent";
import { railSelectorFromEnv, type AttestationStatus } from "@mandatepay/shared";
import type { CycleResponse } from "./types";

export type { CycleResponse } from "./types";
export const DEMO_HR_UPDATE_TEXT = DEMO_HR_UPDATE;

/**
 * Offline attestation status. On a live node this comes from verifyTdxQuote /
 * fetchDkgAttestation against the node's /status (see PHASE1_PLAN §3). Honest
 * "mock" state until then — we don't fake a verified enclave.
 */
function attestationStatus(): AttestationStatus {
  return {
    state: "mock",
    source: "offline-mock",
    checkedAtMs: Date.now(),
    note: "Offline build — TDX attestation not yet wired. On a live node this badge reflects a real enclave measurement (RTMR3).",
  };
}

/**
 * Run one full payroll cycle for the demo. Everything happens server-side:
 * the CFO signs a bounded mandate, the agent interprets the HR update, computes
 * the proposal, halts anomalies, and dispatches ready lines through the mock rail.
 * Returns real, zero-PII objects the UI renders directly.
 */
export async function runDemoCycle(hrUpdate: string): Promise<CycleResponse> {
  const selector = railSelectorFromEnv(process.env.MANDATEPAY_RAIL);
  // Live rail needs an authenticated client (PHASE1_PLAN §3); offline we use mock.
  const rail = new MockStripeRail();
  const llm = createLlmClient(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL);

  const { mandate } = buildDemoMandate();
  const cycleId = `cycle-${new Date().toISOString().slice(0, 7)}`;

  const result = await runPayrollCycle({
    cycleId,
    rawHrUpdate: hrUpdate,
    roster: DEMO_EMPLOYEES,
    mandate,
    rail,
    llm,
    agentActorDid: DEMO_AGENT_DID,
    baselines: DEMO_BASELINES,
  });

  return {
    mandate,
    mandateVerified: verifyMandate(mandate),
    roster: DEMO_EMPLOYEES,
    proposal: result.proposal,
    receipts: result.receipts,
    ledger: result.ledger,
    dispatched: result.dispatched,
    attestation: attestationStatus(),
    // Report the configured selector so the UI is honest about which rail it WOULD use,
    // while the offline build always executes on the mock rail.
    railKind: selector === "t3-payroll" ? "t3-payroll (configured; offline falls back to mock)" : rail.kind,
    llmKind: llm.kind,
  };
}
