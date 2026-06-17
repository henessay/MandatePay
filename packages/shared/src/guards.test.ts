import { describe, it, expect } from "vitest";
import { assertNoRawAccount, looksLikeRealAccount, RawAccountLeakError } from "./guards.js";
import type { EmployeePayoutContext } from "./payout.js";

describe("looksLikeRealAccount", () => {
  it("flags IBANs", () => {
    expect(looksLikeRealAccount("DE89370400440532013000")).toBeTruthy();
    expect(looksLikeRealAccount("GB82 WEST 1234 5698 7654 32")).toBeTruthy();
  });

  it("flags Luhn-valid card PANs (spaced or joined)", () => {
    expect(looksLikeRealAccount("4242 4242 4242 4242")).toBeTruthy();
    expect(looksLikeRealAccount("4242424242424242")).toBeTruthy();
  });

  it("flags long account-number digit runs", () => {
    expect(looksLikeRealAccount("000123456789012")).toBeTruthy();
  });

  it("does NOT flag MandatePay opaque refs", () => {
    expect(looksLikeRealAccount("acct_ref_3f9a2c8b")).toBeNull();
    expect(looksLikeRealAccount("acct_ref_alice")).toBeNull();
  });

  it("does NOT flag employee ids, small amounts, or short numbers", () => {
    expect(looksLikeRealAccount("emp_004")).toBeNull();
    expect(looksLikeRealAccount("2592000")).toBeNull(); // 7-digit cents amount
    expect(looksLikeRealAccount("cycle-2026-06")).toBeNull();
  });
});

describe("assertNoRawAccount", () => {
  it("passes a clean zero-PII payout context", () => {
    const ctx: EmployeePayoutContext = {
      employeeId: "emp_001",
      displayName: "Alice Tan",
      team: "engineering",
      recipientRef: "acct_ref_3f9a2c8b",
      amountCents: 2_592_000,
      currency: "SGD",
      mandateVcId: "a1b2c3d4e5f6",
      note: "Full base salary, no anomalies.",
    };
    expect(() => assertNoRawAccount(ctx)).not.toThrow();
  });

  it("throws if a real account number sneaks into the free-text note", () => {
    const ctx: EmployeePayoutContext = {
      employeeId: "emp_001",
      displayName: "Alice Tan",
      team: "engineering",
      recipientRef: "acct_ref_3f9a2c8b",
      amountCents: 2_592_000,
      currency: "SGD",
      mandateVcId: "a1b2c3d4e5f6",
      note: "send to DE89370400440532013000 please",
    };
    expect(() => assertNoRawAccount(ctx)).toThrow(RawAccountLeakError);
  });

  it("reports the offending path", () => {
    try {
      assertNoRawAccount({ a: { b: ["ok", "4242 4242 4242 4242"] } });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RawAccountLeakError);
      expect((e as RawAccountLeakError).path).toBe("$.a.b[1]");
    }
  });
});
