// R1 live probe — STEP 5: clear the `NoGrant` wall via the DOCUMENTED authorization
// path — `tee:user/contracts` → `agent-auth-update` (a self-grant), NOT org-data.
// Source: docs invoke-contract walkthrough §1 "Authorize the contract's egress".
// Then retry compute-payroll. Reads creds from .env.

import { readFileSync } from "node:fs";
import {
  T3nClient, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput,
  getScriptVersion, getNodeUrl, PAYROLL_FUNCTIONS_V1, NODE_URLS, setGlobalLogLevel, LogLevel,
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
  console.log("  THREW:", e?.message ?? e);
  for (const k of ["detail", "requestId", "code"]) if (e?.[k] !== undefined) console.log(`    ${k}:`, e[k]);
}

const address = eth_get_address(key);
const wasm = await loadWasmComponent();
const client = new T3nClient({ baseUrl, wasmComponent: wasm, handlers: { EthSign: metamask_sign(address, undefined, key) } });
await client.handshake();
const did = await client.authenticate(createEthAuthInput(address));
const myDid = did?.value ?? String(did);
console.log("DID:", myDid, "\n");

const PAYROLL = "tee:payroll/contracts";
const payrollVersion = await getScriptVersion(baseUrl, PAYROLL);
const userVersion = await getScriptVersion(baseUrl, "tee:user/contracts");
console.log(`versions: ${PAYROLL}@${payrollVersion}  tee:user/contracts@${userVersion}\n`);

async function grant(scriptName, versionReq) {
  console.log(`-- agent-auth-update: self-grant on "${scriptName}" v=${versionReq} fns=[${PAYROLL_FUNCTIONS_V1.join(",")}] --`);
  try {
    const r = await client.executeAndDecode({
      script_name: "tee:user/contracts",
      script_version: userVersion,
      function_name: "agent-auth-update",
      input: {
        agents: [{
          agentDid: myDid,                       // self-grant: agent == user
          scripts: [{
            scriptName,
            versionReq,
            functions: [...PAYROLL_FUNCTIONS_V1],
            allowedHosts: [],
          }],
        }],
      },
    });
    console.log("  OK:", j(r));
    return true;
  } catch (e) { dump(e); return false; }
}

async function computePayroll() {
  console.log("\n-- retry compute-payroll (post-grant) --");
  try {
    const r = await client.executeAndDecode({
      script_name: PAYROLL, script_version: payrollVersion, function_name: "compute-payroll",
      input: { request: {
        org_id: myDid, cycle_id: "cycle-2026-06",
        pay_period_start: "2026-06-01", pay_period_end: "2026-06-30",
        batch_cap_cents: "1000000", historical_baselines: {},
      } },
    });
    console.log("  DECODED RESPONSE:", j(r));
  } catch (e) { dump(e); }
}

// Try the executable name first (matches the invoke script_name + the doc example pattern).
await grant(PAYROLL, payrollVersion);
await computePayroll();
// Fallback: the NoGrant message referenced the LOGICAL name "tee:payroll".
await grant("tee:payroll", payrollVersion);
await computePayroll();

console.log("\nSTEP 5 DONE.");
