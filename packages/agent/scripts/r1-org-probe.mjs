// R1 live probe — STEP 4: reverse-probe the organisation contract's create API
// (undocumented in the SDK). Call with guessed function names + minimal input and
// read the node's error envelopes to learn the required shape. Reads creds from .env.

import { readFileSync } from "node:fs";
import {
  T3nClient, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput,
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
function dump(e) {
  console.log("  ->", e?.message ?? e);
}

const address = eth_get_address(key);
const wasm = await loadWasmComponent();
const client = new T3nClient({ baseUrl, wasmComponent: wasm, handlers: { EthSign: metamask_sign(address, undefined, key) } });
await client.handshake();
const did = await client.authenticate(createEthAuthInput(address));
const myDid = did?.value ?? String(did);
console.log("DID:", myDid, "\n");

const SCRIPT = "tee:organisation/contracts";
const VERSION = "0.1.19";

async function probe(functionName, input) {
  console.log(`-- ${SCRIPT}@${VERSION} fn="${functionName}" input=${JSON.stringify(input)} --`);
  try {
    const r = await client.executeAndDecode({ script_name: SCRIPT, script_version: VERSION, function_name: functionName, input });
    console.log("  OK:", JSON.stringify(r));
  } catch (e) { dump(e); }
}

// 1) bogus function name — many contracts echo the valid set or "unknown function"
await probe("__nope__", {});
// 2) likely create names with empty input — reveals required fields via "missing field"
await probe("create", {});
await probe("create-organisation", {});
await probe("create-org", {});

console.log("\nSTEP 4 DONE.");
