import { describe, it, expect, beforeAll } from "vitest";
import { signCredential } from "@terminal3/t3n-sdk";
import { keypairFromHex, ethAddressFromSecret } from "./keys.js";

/**
 * End-to-end smoke for the wallet SIWE login + /app gating, against a running
 * `pnpm --filter @mandatepay/web start` on :3000. Self-skips when the server is
 * not up, so `pnpm -r test` stays green offline. Signs with the SDK (the same
 * EIP-191 path a browser wallet uses on the wire).
 */
const BASE = "http://localhost:3000";

// Must match apps/web/lib/siwe.ts byte-for-byte.
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

let up = false;
beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/auth/me`);
    up = r.ok;
  } catch {
    up = false;
  }
});

describe("auth HTTP flow", () => {
  it("nonce → sign → login → me → gated /app, and rejects a bad signature", async () => {
    if (!up) {
      console.warn("[auth-http.smoke] server not on :3000 — skipping");
      return;
    }

    const { secret } = keypairFromHex("0x" + "a1".repeat(32));
    const address = ethAddressFromSecret(secret).toLowerCase();

    const { nonce } = (await fetch(`${BASE}/api/auth/nonce`).then((r) => r.json())) as {
      nonce: string;
    };
    expect(typeof nonce).toBe("string");

    const msg = new TextEncoder().encode(buildLoginMessage(address, nonce));
    const { sig } = signCredential(msg, secret);
    const signature = "0x" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");

    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signature, nonce }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("mp_session=");
    const cookie = setCookie.split(";")[0] ?? "";

    const me = (await fetch(`${BASE}/api/auth/me`, { headers: { cookie } }).then((r) =>
      r.json(),
    )) as { address: string | null };
    expect(me.address).toBe(address);

    const noCookie = await fetch(`${BASE}/app`, { redirect: "manual" });
    expect([307, 308]).toContain(noCookie.status);
    const withCookie = await fetch(`${BASE}/app`, { headers: { cookie }, redirect: "manual" });
    expect(withCookie.status).toBe(200);

    const bad = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signature: "0x" + "11".repeat(65), nonce }),
    });
    expect(bad.status).toBe(401);
  });
});
