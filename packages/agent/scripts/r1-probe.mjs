// R1 live probe — STEP 1 (read-only): authenticate via Eth (SIWE) and read the
// tenant's usage/credits. Moves no money, writes nothing. Reads creds from .env.
//
//   node packages/agent/scripts/r1-probe.mjs
//
// .env keys used: T3N_NODE_URL (default: testnet), T3N_DEMO_KEY (required, 0x+32B),
// T3N_API_KEY (optional bearer for the node edge).
//
// Later steps (tenant bootstrap, roster push, compute-payroll, execute-disbursement)
// are added incrementally once this step is confirmed — we do NOT guess wire shapes.

import { readFileSync } from "node:fs";
import {
  T3nClient,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
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
  } catch {
    /* no .env */
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const baseUrl = env.T3N_NODE_URL || NODE_URLS.testnet;
const key = env.T3N_DEMO_KEY;
if (!key) {
  console.error("ERROR: T3N_DEMO_KEY not set in .env (need a 0x-prefixed 32-byte EOA key).");
  process.exit(1);
}

setGlobalLogLevel(LogLevel.WARN);

// fetch tap — ground truth on hosts/paths hit
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  const r = await realFetch(input, init).catch((e) => {
    console.log(`    [fetch] ${init?.method ?? "GET"} ${url} -> NETERR ${e.message}`);
    throw e;
  });
  console.log(`    [fetch] ${init?.method ?? "GET"} ${url} -> ${r.status}`);
  return r;
};

const address = eth_get_address(key);
console.log("baseUrl :", baseUrl);
console.log("address :", address);

const wasmComponent = await loadWasmComponent();
const client = new T3nClient({
  baseUrl,
  wasmComponent,
  handlers: { EthSign: metamask_sign(address, undefined, key) },
  // NOTE: header name is a GUESS until confirmed; only attached if a key is present.
  ...(env.T3N_API_KEY ? { headers: { Authorization: `Bearer ${env.T3N_API_KEY}` } } : {}),
});

console.log("\n-- handshake --");
const hs = await client.handshake();
console.log("handshake:", JSON.stringify(hs));

console.log("\n-- authenticate (Eth / SIWE) --");
const did = await client.authenticate(createEthAuthInput(address));
console.log("DID      :", did?.value ?? String(did));
console.log("DID fmt  :", /^did:t3n:[0-9a-f]{40}$/.test(did?.value ?? "") ? "matches did:t3n:<40-hex>" : "UNEXPECTED FORMAT");

console.log("\n-- getUsage (tenant credits / state, read-only) --");
try {
  const usage = await client.getUsage();
  console.log("usage    :", JSON.stringify(usage, (_k, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 1));
} catch (e) {
  console.log("getUsage THREW:", e?.name, e?.message);
}

console.log("\nSTEP 1 DONE (read-only). Next: tenant bootstrap / roster / compute-payroll.");
