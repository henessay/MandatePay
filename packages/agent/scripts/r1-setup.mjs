// R1 live probe — STEP 3: stand up org-data authorization (policy + grant) for our
// own DID acting as a single-member org, then retry compute-payroll to clear the
// `NoGrant` wall. Writes org-data state; moves no money. Reads creds from .env.
//
//   node packages/agent/scripts/r1-setup.mjs

import { readFileSync } from "node:fs";
import {
  T3nClient, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput,
  createOrgDataClientFromSession, getScriptVersion, PAYROLL_FUNCTIONS_V1,
  NODE_URLS, setGlobalLogLevel, LogLevel,
} from "@terminal3/t3n-sdk";

function loadEnv(p = ".env") {
  const e = {};
  try { for (const l of readFileSync(p, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trimStart().startsWith("#")) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
  } } catch {}
  return { ...e, ...process.env };
}
const env = loadEnv();
const baseUrl = env.T3N_NODE_URL || NODE_URLS.testnet;
const key = env.T3N_DEMO_KEY;
if (!key) { console.error("ERROR: T3N_DEMO_KEY not set"); process.exit(1); }

setGlobalLogLevel(LogLevel.WARN);
const realFetch = globalThis.fetch;
globalThis.fetch = async (i, init) => {
  const u = typeof i === "string" ? i : (i?.url ?? String(i));
  const r = await realFetch(i, init);
  console.log(`    [fetch] ${init?.method ?? "GET"} ${u.replace(/\?.*/, "")} -> ${r.status}`);
  return r;
};
const j = (o) => JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 1);
function dump(e) {
  console.log("  THREW:", e?.name, "-", e?.message);
  for (const k of ["detail", "requestId", "code"]) if (e?.[k] !== undefined) console.log(`    ${k}:`, e[k]);
}

const address = eth_get_address(key);
const wasm = await loadWasmComponent();
const client = new T3nClient({ baseUrl, wasmComponent: wasm, handlers: { EthSign: metamask_sign(address, undefined, key) } });
await client.handshake();
const did = await client.authenticate(createEthAuthInput(address));
const myDid = did?.value ?? String(did);
console.log("DID:", myDid, "\n");

const org = createOrgDataClientFromSession(client, baseUrl);
const CONTRACT = "tee:payroll";       // logical name the grant is keyed by
const SCOPE = "payroll/employees";

const step = async (label, fn) => {
  console.log(`-- ${label} --`);
  try { const r = await fn(); console.log("  OK:", j(r)); return r; }
  catch (e) { dump(e); return undefined; }
};

await step("getScriptVersion(tee:org-data/contracts)", () => getScriptVersion(baseUrl, "tee:org-data/contracts"));
await step("policyGet(org=myDid) — does a policy already exist?", () => org.policyGet({ orgDid: myDid }));
await step("createPolicy(org=myDid, admin=myDid)", () => org.createPolicy({ orgDid: myDid, initialAdminDid: myDid }));
await step("setGrants(tee:payroll -> myDid, PAYROLL_FUNCTIONS_V1)", () =>
  org.setGrants({
    orgDid: myDid, contractId: CONTRACT,
    grants: [{ user_did: myDid, functions: [...PAYROLL_FUNCTIONS_V1], scopes: [SCOPE], constraints: {}, expires_at_secs: null }],
  }));
await step("grantsGet(tee:payroll) — verify", () => org.grantsGet({ orgDid: myDid, contractId: CONTRACT }));

// retry compute-payroll now that a grant should exist
console.log("\n-- compute-payroll retry (post-grant, empty roster) --");
try {
  const decoded = await client.executeAndDecode({
    script_name: "tee:payroll/contracts", script_version: "5.2.0", function_name: "compute-payroll",
    input: { request: {
      org_id: myDid, cycle_id: "cycle-2026-06",
      pay_period_start: "2026-06-01", pay_period_end: "2026-06-30",
      batch_cap_cents: "1000000", historical_baselines: {},
    } },
  });
  console.log("  DECODED RESPONSE:", j(decoded));
} catch (e) { dump(e); }

console.log("\nSTEP 3 DONE.");
