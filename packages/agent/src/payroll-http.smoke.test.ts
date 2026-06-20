import { describe, it, expect, beforeAll } from "vitest";
import { signCredential } from "@terminal3/t3n-sdk";
import { keypairFromHex, ethAddressFromSecret } from "./keys.js";

/**
 * End-to-end smoke for a payroll run over the org roster, against a running web
 * server on :3000 with the default (mock) rail. Self-skips offline. The mock
 * rail now "dispatches" to 0x wallet addresses, so the full org -> proposal ->
 * bounds -> dispatch path is exercised without a live chain.
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
  const { nonce } = (await fetch(`${BASE}/api/auth/nonce`).then((r) => r.json())) as { nonce: string };
  const { sig } = signCredential(new TextEncoder().encode(buildLoginMessage(address, nonce)), secret);
  const signature = "0x" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, signature, nonce }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

type RunResult = {
  rows: { status: string; wallet: string; amountCents: number }[];
  dispatched: boolean;
  withinCeiling: boolean;
  ledger: unknown[];
  railKind: string;
};

let up = false;
beforeAll(async () => {
  try {
    up = (await fetch(`${BASE}/api/auth/me`)).ok;
  } catch {
    up = false;
  }
});

describe("payroll run over the org", () => {
  it("seeds 15, runs payroll, dispatches to wallets within the ceiling", async () => {
    if (!up) {
      console.warn("[payroll-http.smoke] server not on :3000 — skipping");
      return;
    }
    const cookie = await login();
    await fetch(`${BASE}/api/org/seed`, { method: "POST", headers: { cookie } });

    const run = (await fetch(`${BASE}/api/payroll/run`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ instruction: "Pay this month's salaries for the whole team." }),
    }).then((r) => r.json())) as RunResult;

    expect(run.rows.length).toBe(15);
    expect(run.dispatched).toBe(true);
    expect(run.withinCeiling).toBe(true);
    expect(run.ledger.length).toBeGreaterThan(0);
    // mock rail "dispatches" to every 0x wallet
    expect(run.rows.every((r) => r.status === "dispatched")).toBe(true);
    expect(run.rows.every((r) => /^0x[0-9a-fA-F]{40}$/.test(r.wallet))).toBe(true);
  });
});
