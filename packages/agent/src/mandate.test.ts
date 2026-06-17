import { describe, it, expect } from "vitest";
import { PAYROLL_FUNCTIONS_V1 } from "@terminal3/t3n-sdk";
import { signMandate, verifyMandate, isMandateActive } from "./mandate.js";
import { generateKeypair, keypairFromHex, ethAddressFromSecret } from "./keys.js";

const ORG_DID = "did:t3n:" + "ab".repeat(20);
const CFO_DID = "did:t3n:" + "cd".repeat(20);

function baseArgs(overrides: Record<string, unknown> = {}) {
  const cfo = keypairFromHex("0x" + "11".repeat(32));
  const agent = generateKeypair();
  const now = Math.floor(Date.now() / 1000);
  return {
    orgDid: ORG_DID,
    userDid: CFO_DID,
    cfoSecret: cfo.secret,
    agentPubkeyCompressed: agent.pubkeyCompressed,
    functions: [...PAYROLL_FUNCTIONS_V1],
    ceilingCents: 50_000_00,
    individualThresholdCents: 15_000_00,
    notBeforeSecs: now,
    notAfterSecs: now + 30 * 86_400,
    ...overrides,
  };
}

describe("signMandate / verifyMandate", () => {
  it("signs a bounded mandate and recovers the CFO as signer", () => {
    const m = signMandate(baseArgs());
    expect(verifyMandate(m)).toBe(true);
    const cfoAddr = ethAddressFromSecret(keypairFromHex("0x" + "11".repeat(32)).secret);
    expect(m.signerAddress.toLowerCase()).toBe(cfoAddr.toLowerCase());
  });

  it("carries the signed bounds in the terms", () => {
    const m = signMandate(baseArgs());
    expect(m.terms.ceilingCents).toBe(50_000_00);
    expect(m.terms.individualThresholdCents).toBe(15_000_00);
    expect(m.terms.contract).toBe("tee:payroll");
    expect(m.terms.functions).toEqual([...PAYROLL_FUNCTIONS_V1].sort());
    expect(m.terms.vcId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces a 65-byte EIP-191 signature (base64url)", () => {
    const m = signMandate(baseArgs());
    // 65 bytes -> base64url-no-pad: 4*21 + 3 = 87 chars (65 = 3*21 + 2 remainder)
    expect(m.userSigB64u.length).toBe(87);
    expect(m.userSigB64u).not.toMatch(/[+/=]/); // base64url, no padding
  });

  it("detects tampering: a flipped signature fails verification", () => {
    const m = signMandate(baseArgs());
    // Flip the first base64url char to a guaranteed-different value (deterministic).
    const first = m.userSigB64u[0] === "A" ? "B" : "A";
    const tampered = { ...m, userSigB64u: first + m.userSigB64u.slice(1) };
    expect(tampered.userSigB64u).not.toBe(m.userSigB64u);
    expect(verifyMandate(tampered)).toBe(false);
  });

  it("two different CFO keys recover to different signers", () => {
    const m1 = signMandate(baseArgs());
    const m2 = signMandate(baseArgs({ cfoSecret: keypairFromHex("0x" + "22".repeat(32)).secret }));
    expect(m1.signerAddress).not.toBe(m2.signerAddress);
    expect(verifyMandate(m2)).toBe(true);
  });

  it("isMandateActive respects the signed window", () => {
    const now = Math.floor(Date.now() / 1000);
    const m = signMandate(baseArgs({ notBeforeSecs: now + 100, notAfterSecs: now + 200 }));
    expect(isMandateActive(m, now)).toBe(false); // before window
    expect(isMandateActive(m, now + 150)).toBe(true); // inside
    expect(isMandateActive(m, now + 999)).toBe(false); // after window
  });
});
