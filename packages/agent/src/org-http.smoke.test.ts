import { describe, it, expect, beforeAll } from "vitest";
import { signCredential } from "@terminal3/t3n-sdk";
import { keypairFromHex, ethAddressFromSecret } from "./keys.js";

/**
 * End-to-end smoke for organisation CRUD behind the wallet session, against a
 * running `pnpm --filter @mandatepay/web start` on :3000. Self-skips offline.
 */
const BASE = "http://localhost:3000";

function buildLoginMessage(address: string, nonce: string): string {
  return [
    "MandatePay wants you to sign in with your Ethereum account:",
    address,
    "",
    "Sign in to MandatePay — bounded payroll delegation. This signature proves wallet ownership; it costs no gas and authorises no payment.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

async function login(): Promise<string> {
  const { secret } = keypairFromHex("0x" + "a1".repeat(32));
  const address = ethAddressFromSecret(secret).toLowerCase();
  const { nonce } = (await fetch(`${BASE}/api/auth/nonce`).then((r) => r.json())) as {
    nonce: string;
  };
  const { sig } = signCredential(new TextEncoder().encode(buildLoginMessage(address, nonce)), secret);
  const signature = "0x" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, signature, nonce }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

type OrgEmp = { employeeId: string; displayName: string; wallet: string };
type OrgResp = { org: { name: string; employees: OrgEmp[] } | null };

let up = false;
beforeAll(async () => {
  try {
    up = (await fetch(`${BASE}/api/auth/me`)).ok;
  } catch {
    up = false;
  }
});

describe("organisation CRUD", () => {
  it("create → seed → add → reject-bad → remove, all behind the session", async () => {
    if (!up) {
      console.warn("[org-http.smoke] server not on :3000 — skipping");
      return;
    }
    const cookie = await login();
    expect(cookie).toContain("mp_session=");
    const h = { cookie, "content-type": "application/json" };

    // unauthorised without cookie
    expect((await fetch(`${BASE}/api/org`)).status).toBe(401);

    // create
    const created = (await fetch(`${BASE}/api/org`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Smoke Co." }),
    }).then((r) => r.json())) as OrgResp;
    expect(created.org?.name).toBe("Smoke Co.");

    // seed 15
    const seeded = (await fetch(`${BASE}/api/org/seed`, { method: "POST", headers: { cookie } }).then(
      (r) => r.json(),
    )) as OrgResp;
    expect(seeded.org?.employees.length).toBeGreaterThanOrEqual(15);

    // add a valid employee
    const added = (await fetch(`${BASE}/api/org/employees`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        displayName: "Smoke Tester",
        position: "QA",
        team: "eng",
        wallet: "0x" + "ab".repeat(20),
        baseSalaryUsd: 5000,
        bonusEligible: true,
      }),
    }).then((r) => r.json())) as OrgResp;
    const addedEmp = added.org?.employees.find((e) => e.displayName === "Smoke Tester");
    expect(addedEmp).toBeTruthy();

    // reject a bad wallet
    const bad = await fetch(`${BASE}/api/org/employees`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ displayName: "Bad", wallet: "not-an-address", baseSalaryUsd: 100 }),
    });
    expect(bad.status).toBe(400);

    // remove the one we added
    const removed = (await fetch(
      `${BASE}/api/org/employees?id=${addedEmp!.employeeId}`,
      { method: "DELETE", headers: { cookie } },
    ).then((r) => r.json())) as OrgResp;
    expect(removed.org?.employees.find((e) => e.employeeId === addedEmp!.employeeId)).toBeFalsy();
  });
});
