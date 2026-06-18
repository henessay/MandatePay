// Live repro harness for FEEDBACK_T3.md #9 and #10 (and #20 corroboration).
// Runs the README examples VERBATIM against the real testnet node and records
// the exact failure modes. Not part of the build/test; run manually:
//   node packages/agent/scripts/repro-handshake.mjs
//
// Uses an EPHEMERAL throwaway secp256k1 key (handshake precedes authenticate(),
// so no real/funded key is needed). No secrets are read or written.

import { randomBytes } from "node:crypto";
import {
  T3nClient,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createDefaultHandlers,
  NODE_URLS,
  getNodeUrl,
  getEnvironment,
  setGlobalLogLevel,
  LogLevel,
} from "@terminal3/t3n-sdk";

const TESTNET = NODE_URLS.testnet; // https://cn-api.sg.testnet.t3n.terminal3.io

// ---- instrument global fetch: ground-truth on which host is actually hit ----
const fetchLog = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  let res, err;
  try {
    res = await realFetch(input, init);
    return res;
  } catch (e) {
    err = e;
    throw e;
  } finally {
    fetchLog.push(`    [fetch] ${init?.method ?? "GET"} ${url} -> ${err ? "NETERR " + err.message : res?.status}`);
  }
};

setGlobalLogLevel(LogLevel.WARN); // keep SDK noise low; our fetch log is the evidence

const ephemeralKey = "0x" + randomBytes(32).toString("hex");
const address = eth_get_address(ephemeralKey);

function banner(t) {
  console.log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));
}
function dumpErr(e) {
  console.log("  RESULT: THREW");
  console.log("  name   :", e?.name);
  console.log("  message:", e?.message);
  if (e?.detail) console.log("  detail :", e.detail);
  if (e?.requestId) console.log("  reqId  :", e.requestId);
  if (e?.cause) console.log("  cause  :", e.cause?.message ?? e.cause);
  const stack = (e?.stack ?? "").split("\n").slice(0, 4).join("\n");
  console.log("  stack  :\n" + stack.replace(/^/gm, "    "));
}

async function scenario(name, makeClient) {
  banner(name);
  fetchLog.length = 0;
  let client;
  try {
    client = makeClient();
  } catch (e) {
    console.log("  (client construction threw)");
    dumpErr(e);
    console.log("  fetches:\n" + (fetchLog.join("\n") || "    (none)"));
    return;
  }
  try {
    const r = await client.handshake();
    console.log("  RESULT: handshake() RESOLVED:", JSON.stringify(r));
  } catch (e) {
    dumpErr(e);
  }
  console.log("  fetches:\n" + (fetchLog.join("\n") || "    (none)"));
}

console.log("env default      :", getEnvironment());
console.log("getNodeUrl()     :", getNodeUrl());
console.log("NODE_URLS.testnet:", TESTNET);
console.log("ephemeral address:", address);

const wasm = await loadWasmComponent();
console.log("loadWasmComponent: OK (Node, no wasmPath)");

// --- Scenario A — FEEDBACK #9: README "Quick Start" handler set (EthSign ONLY),
//     but baseUrl pinned to the REAL testnet node so we get past the network and
//     actually test whether the missing MlKemPublicKey/Random handlers are fatal.
await scenario(
  "A — #9: handlers = { EthSign } ONLY, baseUrl = testnet  (README Quick Start handler set)",
  () =>
    new T3nClient({
      baseUrl: TESTNET,
      wasmComponent: wasm,
      handlers: { EthSign: metamask_sign(address, undefined, ephemeralKey) },
    }),
);

// --- Scenario B — #9 control: the FIX we recommend — createDefaultHandlers(baseUrl)
//     spread in, plus EthSign. Confirms what is ACTUALLY required to handshake.
await scenario(
  "B — #9 control: handlers = { ...createDefaultHandlers(testnet), EthSign }",
  () =>
    new T3nClient({
      baseUrl: TESTNET,
      wasmComponent: wasm,
      handlers: {
        ...createDefaultHandlers(TESTNET),
        EthSign: metamask_sign(address, undefined, ephemeralKey),
      },
    }),
);

// --- Scenario C — FEEDBACK #10: README "Ethereum Authentication" block VERBATIM —
//     NO baseUrl at all, EthSign only. Record which host it silently targets.
await scenario(
  "C — #10: NO baseUrl, handlers = { EthSign } ONLY  (README Ethereum Auth, verbatim)",
  () =>
    new T3nClient({
      wasmComponent: wasm,
      handlers: { EthSign: metamask_sign(address, undefined, ephemeralKey) },
    }),
);

console.log("\nDONE");
