// R1 live probe — STEP 2: exercise tee:payroll `compute-payroll` and capture the
// REAL wire contract (request shape acceptance + decoded response / error envelope).
// Read-ish: compute-payroll computes but does not disburse. Reads creds from .env.
//
//   node packages/agent/scripts/r1-payroll.mjs
//
// We deliberately probe several shapes and print exactly what the node says, so the
// fix to T3PayrollRail (and any FEEDBACK #27+) rests on observed behavior, not guesses.

import { readFileSync } from "node:fs";
import {
  T3nClient,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  buildPayrollDirectInvocation,
  getScriptVersion,
  NODE_URLS,
  setGlobalLogLevel,
  LogLevel,
} from "@terminal3/t3n-sdk";

function loadEnv(path = ".env") {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trimStart().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return { ...env, ...process.env };
}
const env = loadEnv();
const baseUrl = env.T3N_NODE_URL || NODE_URLS.testnet;
const key = env.T3N_DEMO_KEY;
if (!key) { console.error("ERROR: T3N_DEMO_KEY not set in .env"); process.exit(1); }

setGlobalLogLevel(LogLevel.WARN);
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  const r = await realFetch(input, init);
  console.log(`    [fetch] ${init?.method ?? "GET"} ${url.replace(/\?.*/, "")} -> ${r.status}`);
  return r;
};
const bigintJson = (o) => JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 1);
function dumpErr(e) {
  console.log("  THREW:", e?.name, "-", e?.message);
  if (e?.detail !== undefined) console.log("    detail   :", e.detail);
  if (e?.requestId !== undefined) console.log("    requestId:", e.requestId);
  if (e?.code !== undefined) console.log("    code     :", e.code);
}

const address = eth_get_address(key);
const wasmComponent = await loadWasmComponent();
const client = new T3nClient({ baseUrl, wasmComponent, handlers: { EthSign: metamask_sign(address, undefined, key) } });
await client.handshake();
const did = await client.authenticate(createEthAuthInput(address));
const myDid = did?.value ?? String(did);
console.log("authenticated DID:", myDid);

// ---- resolve script version. KEY FINDING: the registry name carries a `/contracts`
// suffix; the logical contract name `tee:payroll` (used in the delegation credential)
// is NOT the executable script_name. ----
const SCRIPT = "tee:payroll/contracts";
console.log(`\n-- getScriptVersion(${SCRIPT}) --`);
let payrollVersion;
try { payrollVersion = await getScriptVersion(baseUrl, SCRIPT); console.log(`  ${SCRIPT} version =`, payrollVersion); }
catch (e) { dumpErr(e); }

// ---- build a minimal payroll run request ----
const reqBigint = {
  org_id: myDid,
  cycle_id: "cycle-2026-06",
  pay_period_start: "2026-06-01",
  pay_period_end: "2026-06-30",
  batch_cap_cents: 1000000n,               // SGD 10,000 ceiling
  historical_baselines: {},
};
const directInv = buildPayrollDirectInvocation({ request: reqBigint });
console.log("\n-- buildPayrollDirectInvocation output (shape) --");
console.log(bigintJson(directInv));

const tryExec = async (label, payload) => {
  console.log(`\n-- ${label} --`);
  try {
    const decoded = await client.executeAndDecode(payload);
    console.log("  DECODED RESPONSE:", bigintJson(decoded));
    return decoded;
  } catch (e) { dumpErr(e); return undefined; }
};

// compute-payroll with the CORRECT script_name/version + hand-projected wire shape
// (bigints already rendered as decimal strings — the SDK builder's bigints can't be
// JSON-serialized by executeAndDecode, see the TypeError above).
const wireRequest = {
  org_id: myDid,
  cycle_id: "cycle-2026-06",
  pay_period_start: "2026-06-01",
  pay_period_end: "2026-06-30",
  batch_cap_cents: "1000000",
  historical_baselines: {},
};
if (payrollVersion) {
  await tryExec(`compute-payroll | ${SCRIPT}@${payrollVersion} + wire shape`, {
    script_name: SCRIPT, script_version: payrollVersion, function_name: "compute-payroll",
    input: { request: wireRequest },
  });
}

console.log("\nSTEP 2 DONE.");
