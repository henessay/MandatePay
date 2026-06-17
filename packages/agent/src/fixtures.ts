import type { Cents, Roster, RosterEmployee } from "@mandatepay/shared";
import { PAYROLL_FUNCTIONS_V1 } from "@terminal3/t3n-sdk";
import { keypairFromHex, generateKeypair } from "./keys.js";
import { signMandate } from "./mandate.js";
import type { SignedMandate } from "@mandatepay/shared";

/**
 * Demo fixtures for the offline build. The roster names align with both the
 * canonical HR update and the mock vault's opaque refs, so the whole click-through
 * works with zero network. THROWAWAY keys — offline demo only, never real funds.
 */

export const DEMO_ORG_DID = "did:t3n:" + "0a".repeat(20);
export const DEMO_CFO_DID = "did:t3n:" + "0b".repeat(20);
export const DEMO_AGENT_DID = "did:t3n:" + "0c".repeat(20);

/** Throwaway secrets for the offline demo (documented, never production). */
export const DEMO_CFO_SECRET_HEX = "0x" + "a1".repeat(32);
export const DEMO_AGENT_SECRET_HEX = "0x" + "b2".repeat(32);

export const DEMO_EMPLOYEES: RosterEmployee[] = [
  {
    employeeId: "emp_alice",
    displayName: "Alice Tan",
    team: "sales",
    employmentStatus: "active",
    baseSalaryCents: 800_000,
    rate: 1,
    currency: "SGD",
    bankAccountRef: "acct_ref_alice",
    bankAccountChangedRecently: false,
  },
  {
    employeeId: "emp_boris",
    displayName: "Boris Ivanov",
    team: "engineering",
    employmentStatus: "active",
    baseSalaryCents: 1_000_000,
    rate: 1,
    currency: "SGD",
    bankAccountRef: "acct_ref_bob",
    bankAccountChangedRecently: false,
  },
  {
    employeeId: "emp_carol",
    displayName: "Carol Petrov",
    team: "engineering",
    employmentStatus: "active",
    baseSalaryCents: 900_000,
    rate: 1,
    currency: "SGD",
    bankAccountRef: "acct_ref_carol",
    bankAccountChangedRecently: false,
  },
  {
    employeeId: "emp_dinesh",
    displayName: "Dinesh Kumar",
    team: "sales",
    employmentStatus: "active",
    baseSalaryCents: 700_000,
    rate: 1,
    currency: "SGD",
    bankAccountRef: "acct_ref_dinesh",
    bankAccountChangedRecently: false,
  },
  {
    employeeId: "emp_emma",
    displayName: "Emma Lim",
    team: "sales",
    employmentStatus: "active",
    baseSalaryCents: 750_000,
    rate: 1,
    currency: "SGD",
    bankAccountRef: "acct_ref_emma",
    // Triggers the account-changed anomaly halt during the demo cycle.
    bankAccountChangedRecently: true,
  },
];

export const DEMO_ROSTER: Roster = { orgId: DEMO_ORG_DID, employees: DEMO_EMPLOYEES };

/** Previous-cycle net per employee — the anomaly baseline. */
export const DEMO_BASELINES: Record<string, Cents> = {
  emp_alice: 800_000,
  emp_carol: 900_000,
  emp_dinesh: 700_000,
  emp_emma: 750_000,
};

/** The canonical messy HR update from the brief. */
export const DEMO_HR_UPDATE =
  "Boris Ivanov left the company, Carol Petrov is on 0.5 rate from the 15th, sales team gets a 10% bonus";

export interface DemoMandateOptions {
  ceilingCents?: Cents;
  individualThresholdCents?: Cents;
  /** Validity window in seconds from now. */
  windowSecs?: number;
}

/**
 * Build a fully-signed demo mandate offline. Uses the throwaway CFO secret and a
 * fresh agent keypair unless one is provided. Returns the mandate plus the agent
 * keypair hex so callers can dispatch under it.
 */
export function buildDemoMandate(opts: DemoMandateOptions = {}): {
  mandate: SignedMandate;
  agentSecretHex: string;
} {
  const cfo = keypairFromHex(DEMO_CFO_SECRET_HEX);
  const agent = generateKeypair();
  const now = Math.floor(Date.now() / 1000);
  const windowSecs = opts.windowSecs ?? 30 * 86_400;

  const mandate = signMandate({
    orgDid: DEMO_ORG_DID,
    userDid: DEMO_CFO_DID,
    cfoSecret: cfo.secret,
    agentPubkeyCompressed: agent.pubkeyCompressed,
    functions: [...PAYROLL_FUNCTIONS_V1],
    ceilingCents: opts.ceilingCents ?? 50_000_00,
    individualThresholdCents: opts.individualThresholdCents ?? 15_000_00,
    notBeforeSecs: now,
    notAfterSecs: now + windowSecs,
  });

  return {
    mandate,
    agentSecretHex: "0x" + Array.from(agent.secret, (b) => b.toString(16).padStart(2, "0")).join(""),
  };
}
