import { describe, it, expect } from "vitest";
import { assertNoRawAccount, type DisbursementInstruction } from "@mandatepay/shared";
import { MockStripeRail } from "./mockStripe.js";
import { createRail } from "./index.js";
import { FIXTURE_VAULT } from "./vault.js";

function instr(overrides: Partial<DisbursementInstruction> = {}): DisbursementInstruction {
  return {
    cycleId: "cycle-2026-06",
    employeeId: "emp_alice",
    recipientRef: "acct_ref_alice",
    amountCents: 880_000,
    currency: "SGD",
    mandateVcId: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    nonce: "00112233445566778899aabbccddeeff",
    ...overrides,
  };
}

describe("MockStripeRail", () => {
  it("dispatches a known ref and uses the {{account}} placeholder", async () => {
    const rail = new MockStripeRail();
    const r = await rail.dispatch(instr());
    expect(r.status).toBe("dispatched");
    expect(r.placeholderUsed).toBe("{{account}}");
    expect(r.resolvedAccountMasked).toMatch(/^•••• \w{4}$/);
    expect(r.txHash).toBeTruthy();
  });

  it("NEVER returns the real account number in the receipt", async () => {
    const rail = new MockStripeRail();
    const r = await rail.dispatch(instr());
    const real = FIXTURE_VAULT["acct_ref_alice"]!;
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain(real);
    // The receipt itself must survive the zero-PII guard.
    expect(() => assertNoRawAccount(r)).not.toThrow();
  });

  it("rejects an unknown ref", async () => {
    const rail = new MockStripeRail();
    const r = await rail.dispatch(instr({ recipientRef: "acct_ref_ghost" }));
    expect(r.status).toBe("rejected");
    expect(r.reason).toMatch(/unknown recipientRef/);
  });
});

describe("createRail", () => {
  it("defaults to the mock rail", () => {
    expect(createRail("mock").kind).toBe("mock-stripe");
  });

  it("throws for t3-payroll without an authenticated client", () => {
    expect(() => createRail("t3-payroll")).toThrow(/requires an authenticated T3n client/);
  });
});
