# Terminal 3 SDK Capabilities — Phase 0 Reconnaissance

**Date:** 2026-06-17
**SDK probed:** `@terminal3/t3n-sdk@3.7.0` (published ~16h before this writing; 47 versions on npm)
**Method:** The hosted docs (`docs.terminal3.io`) are unreachable from this environment
(egress-blocked for `curl`; **HTTP 403** via the rendering fetcher — Cloudflare/JS bot wall).
So the **source of truth for this report is the shipped SDK itself**: its `index.d.ts`
(3,302 lines of fully-documented public types), the compiled bundle, the WIT-generated
WASM interface stubs, and a **live offline smoke-test** of the crypto/delegation primitives
(see `FEEDBACK_T3.md` #1). Web search corroborates the high-level model.

> **Headline finding:** the capabilities the brief feared were "coming soon" — **agent-auth,
> signing, audit ledger** — are **LIVE and shipping today**, and the SDK ships a
> **purpose-built user→agent _payroll delegation_ system** that maps almost 1:1 onto
> MandatePay. Terminal 3's own canonical marketing example is *"an agent that reads HR data
> and triggers bank transfers without ever holding raw account numbers."* We are building
> their flagship demo. This massively de-risks the project.

---

## Legend

- 🟢 **LIVE** — exported by the SDK, signature confirmed, (and where noted) executed locally.
- 🟡 **LIVE-needs-node** — client API exists & is typed; requires a running T3N node +
  credentials to exercise end-to-end (not verifiable here without the API key + node egress).
- 🔵 **SERVER-SIDE** — real capability, but it lives **inside the TEE/contract**, not as a
  client SDK call. The client participates indirectly (e.g. by passing an opaque ref).
- ⚪️ **NOT-IN-SDK** — named in the brief but absent from the client SDK surface (likely a
  Host-API/contract concern or a not-yet-exposed primitive).

---

## 0. Environment & transport

| Item | Status | Notes |
|---|---|---|
| `setEnvironment("testnet" \| "production")`, `getNodeUrl`, `NODE_URLS` | 🟢 | Two public networks: `testnet`, `production`. `baseUrl` on `T3nClient` overrides. |
| `loadWasmComponent()` | 🟡 | Loads the bundled `session.core.wasm` (all crypto/state-machine logic lives in WASM). Pure-JS exports load fine; WASM init needs a runtime exercise. |
| `HttpTransport` / `MockTransport` | 🟢 | `MockTransport` is exported — **we can unit-test the whole client offline** without a node. Big win for CI. |
| TDX attestation verify: `verifyTdxQuote`, `verifyDkgAttestation`, `fetchDkgAttestation` | 🟡 | Full client-side Intel TDX quote verification (ECDSA P-256 + PCK chain to Intel root + RTMR3). This is the "trust you can see" hook — **we can render real remote-attestation status in the UI.** |

`import` path for everything below: **`@terminal3/t3n-sdk`** (single entry point; one
subpath export `./wasm/generated/session.js`).

---

## 1. `agent-auth` / delegation — 🟢 **LIVE (the headline)**

The brief's #1 judging axis. It exists as a complete **User→Agent Delegation** module with a
**payroll-shaped** request type baked in. Confirmed working **offline** (probe in `FEEDBACK_T3.md` #1).

**Model.** The user (CFO) signs a `DelegationCredential` that binds: the agent's pubkey, the
org DID, the contract (`tee:payroll`), an explicit **allowlist of functions**, data **scopes**,
key/value **metadata constraints**, and a **validity window** (`not_before`/`not_after`). The
agent then makes per-call invocations carrying a fresh nonce + an agent signature over a
request hash. The node verifies both signatures and the credential bounds. Revocation is
first-class (whole-credential or per-function).

```ts
import {
  buildDelegationCredential, canonicaliseCredential, signCredential,
  PAYROLL_FUNCTIONS_V1, compactDidFromBytes,
  buildPayrollInvocation, buildPayrollDirectInvocation,
  DelegationCustodialClient, revokeDelegation,
} from "@terminal3/t3n-sdk";

// 1) CFO builds + signs the bounded mandate (EOA path — runs fully client-side/offline):
const cred = buildDelegationCredential({
  user_did, agent_pubkey, org_did,
  contract: "tee:payroll",
  functions: [...PAYROLL_FUNCTIONS_V1], // compute-payroll, execute-disbursement, finalize-audit, submit-escalations, validate-credentials
  scopes: ["payroll/employees"],
  not_before_secs, not_after_secs,      // bigint|number; emitted as JSON strings
  vc_id,                                // 16 random bytes
});
const jcs = canonicaliseCredential(cred);            // RFC 8785 JCS
const { sig, addr } = signCredential(jcs, cfoSecret); // 65-byte EIP-191 sig; addr == signer
```

| Symbol | Status | Purpose |
|---|---|---|
| `DelegationCredential`, `DelegationEnvelope` | 🟢 | Wire shapes (byte-identical to Rust, KAT-pinned). |
| `buildDelegationCredential` / `validateCredentialBody` | 🟢 | Build + enforce body invariants (≤16 functions, sorted/deduped, window). **Tested offline.** |
| `canonicaliseCredential` / `canonicaliseRequest` / `requestHash` | 🟢 | RFC 8785 JCS + SHA-256. **Tested offline (489-byte JCS).** |
| `signCredential` (EOA) / `eip191Digest` / `ethRecoverEip191` | 🟢 | EIP-191 sign + recover. **Tested: recovered signer == `eth_get_address(pk)`.** |
| `DelegationCustodialClient.signCustodial` | 🟡 | TEE-custodial signing for **OIDC/email users** whose key the TEE holds (`tee:delegation/contracts::sign`). Needs node. |
| `signAgentInvocation` / `buildInvocationPreimage` | 🟢 | Per-call agent secp256k1 signature over `domain‖vc_id‖nonce‖request_hash`. |
| `buildPayrollInvocation` (delegated) / `buildPayrollDirectInvocation` | 🟢 | Assemble the `{envelope, request}` (or `{request}`) the agent sends. |
| `revokeDelegation` | 🟡 | `tee:delegation/contracts::revoke`; whole or per-function; only `user_did` may call. Needs node. |
| `PAYROLL_FUNCTIONS_V1`, `DELEGATION_*_DOMAIN`, length consts | 🟢 | Constants. |

**Why this is the centerpiece (and not decoration):** the deterministic bounds — function
allowlist, scopes, validity window, and the **batch ceiling** — are sealed into a
user-signed credential and re-checked on-chain/in-TEE. The agent **cannot** widen them.

---

## 2. `signing` — 🟢 **LIVE**

| Symbol | Status | Purpose |
|---|---|---|
| `eth_get_address`, `metamask_sign`, `metamask_get_address` | 🟢 | EOA addressing + MetaMask/`window.ethereum` `EthSign` handler. **`eth_get_address` tested.** |
| `signCredential`, `signAgentInvocation`, `eip191Digest`, `ethRecoverEip191` | 🟢 | See §1. EIP-191 + raw compact ECDSA. |
| `T3nClient.getSelfEthAddress`, `listUserWallets`, `getWalletHistory` | 🟡 | Per-user **TEE-custodial wallets** (`sign-as-user`). The TEE signs for OIDC/email users who never touch a key. Needs node. |
| `DelegationCustodialClient.signCustodial` | 🟡 | TEE signs a delegation credential for a custodial user. Needs node. |

So "signing" is **dual-mode**: self-custody EOA (client-side, offline) **and** TEE-custodial
(node-side). Both feed the same delegation flow.

---

## 3. `http-with-placeholders` — 🔵 **SERVER-SIDE (not a client call)** + ⚪️ no client symbol

**The string `placeholder` / `http-with-placeholders` appears _nowhere_ in the SDK** (types,
bundle, or WIT). It is **not** a client-callable primitive. Based on the SDK's data model +
Terminal 3's own description (*"the ADK wraps every outbound action — substituting sensitive
references inside a TEE — before it reaches the destination"*), the substitution happens
**inside the `tee:payroll` contract / TEE at dispatch time**, keyed off an **opaque reference**
the client supplies. The SDK's own payroll type proves the pattern:

```ts
interface EmployeeRecord {
  // ...
  /** Opaque reference used by the service layer for disbursement. */
  bank_account_ref: string;          // <-- the agent only ever sees THIS
  bank_account_changed_recently: boolean; // <-- anomaly signal, see §7
}
```

**Architectural consequence (important):** the client/agent stores and reasons over
`bank_account_ref` — **never** an IBAN/PAN. The real account is resolved + substituted inside
the TEE during `execute-disbursement`. This is exactly the zero-PII property MandatePay must
demonstrate, and **it's enforced by the data model, not by our discipline.** Our split-screen
"agent saw `{{account}}` vs bank received real IBAN" is a faithful visualization of a real
boundary — see **Risk R1** for what we still must verify against a live node.

---

## 4. Audit ledger — 🟢/🟡 **LIVE**

| Symbol | Status | Purpose |
|---|---|---|
| `T3nClient.getAuditEvents(opts)` → `AuditPage` | 🟡 | Reads the immutable, append-only, **host-stamped** audit trail (`audit.get-mine`). PII-bearing, so the request/response are **session-encrypted**, not plaintext. Needs node. |
| `AuditEvent` { `ts_ms`, `subject`(pii_did), `actor`, `vc_id`, `action`, `target`, `outcome`, `details` } | 🟢 | **Host stamps `subject`/`actor`/`vc_id` from verified dispatch context — a contract cannot forge who acted or on whom.** On a delegated call `actor`=agent, `vc_id`=the delegation credential. This is precisely "who authorized, to whom, how much, when." |
| `AuditBatch.committed` | 🟢 | Tells you whether the emitting tx actually committed — filter for durable events. |
| Delegated read scope | 🟢(semantics) | An agent may read another user's trail **only while that user's agent-auth grant to it is live** (revocable). Ties audit visibility to the live mandate. |

"Merkle proofs": the SDK exposes attestation verification (§0) + host-stamped append-only
batches with `tx_hash` refs. The literal **Merkle-proof object is not a named SDK export** —
treat per-event Merkle inclusion proofs as **🔵 server-side / unverified** until checked on a
node (**Risk R2**). For the demo, "verifiable ledger" = host-stamped immutable batches +
`tx_hash` + TDX attestation of the enclave that wrote them.

---

## 5. Org-data (roster + grants) — 🟡 **LIVE-needs-node**

The store for the employee roster and the agent's coarse grant. Two clients, same surface:

- `OrgDataClient(baseUrl, ethSecret, userDid, opts)` — owns its own ETH session.
- `SessionOrgDataClient(t3n, baseUrl)` / `createOrgDataClientFromSession` — reuses a
  caller-owned authed `T3nClient` (SIWE/OIDC). **Preferred for the web app.**

Methods: `createPolicy`, `updateMeta`, `setWriters`, `setGrants`, `deleteGrants`,
`writeData`, `deleteData`, `deleteScope`, `policyGet`, `writersGet`, `grantsGet`,
`dataList`, `dataGet`. Grant model = `UserGrant { user_did, functions[], scopes[],
constraints{}, expires_at_secs }` under `OrgContractGrants[org‖contract]`.

> Note the **two-layer authorization**: coarse org-level `UserGrant` (who may call what) +
> fine per-run signed `DelegationCredential` (this mandate's exact bounds). Both are
> deterministic and outside the LLM.

---

## 6. Payout / disbursement path — 🔵 **SERVER-SIDE contract** (`tee:payroll`)

There is **no client `disburse()`**. The agent calls contract functions via
`T3nClient.execute` / `executeAndDecode`, passing a `PayrollInvocation`:

```ts
interface PayrollRunRequest {
  org_id; cycle_id; pay_period_start; pay_period_end;
  batch_cap_cents: bigint;                         // <-- the signed CEILING (deterministic)
  historical_baselines: Record<string,string>;     // employee_id -> prev net cents (anomaly basis)
  individual_disbursement_threshold_cents?: bigint; // default SGD 15,000 -> per-line flag threshold
}
```

`PAYROLL_FUNCTIONS_V1 = [compute-payroll, execute-disbursement, finalize-audit,
submit-escalations, validate-credentials]`. The ceiling, per-line threshold, and baselines
are **part of the signed/hashed request** — the agent cannot move money outside them. The
actual Stripe/test-bank dispatch + placeholder substitution happen inside `execute-disbursement`
(🔵). **What we cannot confirm offline:** the exact wire response of each function and whether
the test-merchant rail is wired on testnet (**Risk R1**).

---

## 7. Anomaly / escalation surface — 🟢 (data model present)

The SDK's payroll types already encode the anomaly machinery the brief wants:
`historical_baselines` (per-employee prior net), `individual_disbursement_threshold_cents`
(per-line flag), `EmployeeRecord.bank_account_changed_recently`, and the
`submit-escalations` function in the allowlist. **Clean split:** deterministic thresholds
live in the request/contract; the **LLM's job is interpretation + a natural-language
_explanation_** of why a line was flagged — never the authorization.

---

## 8. Auth, identity, KYC, tokens — 🟡 mostly LIVE-needs-node

| Capability | Status | Notes |
|---|---|---|
| `T3nClient.handshake()` + `authenticate()` — Eth(SIWE), OIDC(Google), Email-OTP | 🟡 | One DID across methods (email-keyed). Eth path is the demo path. |
| `addAuthMethod`, `mergeProfiles`, OTP (`otpRequest`/`otpVerify`/`submitUserInput`/`runOtpThenUserInput`) | 🟡 | Account linking + Level-1 user ingest. |
| KYC: `kycStatus`, `kycStatusPoll` (Veriff) | 🟡 | Not needed for MVP. |
| Token metering: `getUsage`, `formatTokens`, `toBaseUnits`, `BASE_UNITS_PER_TOKEN` | 🟢(math)/🟡(feed) | 6-decimal fixed-point; `getUsage` needs node. Token math **tested offline**. |
| `TenantClient` (+ maps/contracts/token namespaces) | 🟡 | Tenant control-plane: publish/register WASM contracts, maps, logs. We likely **don't** need to author our own contract — `tee:payroll` + `tee:delegation` + `tee:org-data` already exist. |

---

## 9. Brief's "coming soon" list — reconciled

| Brief term | Reality in SDK 3.7.0 |
|---|---|
| `agent-auth` | 🟢 **LIVE** as the delegation module (§1). |
| `signing` | 🟢 **LIVE** — EOA + TEE-custodial (§2). |
| `http-with-placeholders` | 🔵 **server-side TEE**; no client symbol — we pass `bank_account_ref` (§3). |
| `did-registry` | 🟡 DIDs are first-class (`did:t3n:<40-hex>`, `compactDidFromBytes`, minted on auth); no standalone "registry" client API surfaced. |
| `vp` (verifiable presentations) | ⚪️ Not a distinct client export. VCs exist (KYC `vcIds`, ambient ownership VCs) but no VP build/verify API. |
| `outbox` | ⚪️/🔵 Only as a **metered charge reason** (`outbox_egress`) — server-side egress, no client method. |
| `kv-store` | 🔵 Tenant **maps** (`TenantMapsNamespace`) are the KV surface; raw kv not exposed otherwise. |

---

## 10. What I could NOT verify here (gates on the report)

1. **Live node connectivity / egress** to the testnet node URL — needs the user's API key/env
   **and** egress allow-listing for the node host (docs host is currently 403/blocked).
2. **Real `tee:payroll` wire responses** + whether the **Stripe test-merchant rail** is live on
   testnet (Risk R1).
3. **Per-event Merkle inclusion proofs** as a concrete artifact (Risk R2).
4. **WASM handshake** against a real node (only pure-JS + offline crypto exercised so far).

These are the first things to close in Phase 1, and they shape the architecture choices in
the report. See `FEEDBACK_T3.md` for the running bug/doc-gap log.
