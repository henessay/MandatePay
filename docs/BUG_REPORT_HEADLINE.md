# Terminal 3 ADK — Headline Onboarding Bugs (live-verified)

Six reproducible, **live-confirmed** issues hit while building the canonical payroll agent on the T3
ADK. This is the **lead signal** for the bug-reporting prize; the full running log (32 entries) is in
[`FEEDBACK_T3.md`](../FEEDBACK_T3.md). Every item below was reproduced against the live testnet node
and carries a node `request_id` or on-chain `tx` hash.

- **SDK:** `@terminal3/t3n-sdk@3.7.0`
- **Node:** `https://cn-api.sg.testnet.t3n.terminal3.io` (testnet, `phase=ready`)
- **Identity:** demo tenant `did:t3n:cb2c…542e`, 20,000 credits
- **Probes:** `packages/agent/scripts/r1-*.mjs`, `repro-handshake.mjs` (read creds from `.env`)

Ranked by onboarding impact.

---

## 1 · `tee:payroll` is un-provisionable for sandbox developers (no way to create an organisation)
**FEEDBACK #30 · Category: doc-gap / blocker · Severity: HIGH (headline)**

**What:** Every call to the built-in `tee:payroll` contract fails authorization with
`NoGrant: no grant exists for this user on tee:payroll`. Clearing it requires an org-data
`OrgContractGrant`, which requires an initialised org-data **policy**, which requires an
**organisation** — and *no available path creates one*: not the client SDK, the sandbox dashboard
(owner-confirmed: only API-key + DID issuance), the docs, the OpenAPI (`/api-reference/openapi.json`
→ 404), the documented `agent-auth-update` grant, or the `tee:organisation` contract (500).

**Why it hurts onboarding:** This is Terminal 3's *flagship* use case ("the payroll agent"). A
developer with a valid key + the SDK cannot stand up a single working payout, and the failure chain
gives no hint that the missing piece is an un-creatable organisation.

**Repro:**
1. Auth (Eth), then `executeAndDecode({script_name:"tee:payroll/contracts", script_version:"5.2.0", function_name:"compute-payroll", input:{request:{…}}})` → `400 NoGrant` (req `8486af2c-…`).
2. `OrgDataClient.setGrants({orgDid:<ownDID>, contractId:"tee:payroll", …})` → `400 OrgPolicyNotInitialised` (req `83859e1c-…`).
3. `createPolicy({orgDid:<ownDID>, initialAdminDid:<ownDID>})` → `400 OrganisationNotFound: organisation does not exist` (req `f1491d24-…`).

**Suggested fix:** Document the org-bootstrap end-to-end and expose a client method (or worked example)
to create an organisation + obtain its DID; or clarify that `tee:payroll` is internal-only.

---

## 2 · The SDK's built-in `tee:payroll` contradicts the documented "write your own contract" model
**FEEDBACK #32 · Category: doc-gap · Severity: HIGH (headline)**

**What:** The SDK ships `tee:payroll`, `PAYROLL_FUNCTIONS_V1`, `buildPayrollInvocation`,
`EmployeeRecord` as first-class — implying you invoke a built-in payroll contract. The **docs** teach
the opposite: claim a DID → write your **own** TEE contract under `z:<tid>:…` → authorize via
`tee:user/contracts agent-auth-update` → invoke. The only worked walkthrough is a *travel* (Duffel)
contract; the flagship **"Payroll Agent" use-case page is an empty stub** (its entire body is
`See [Delegate Access to AI Agents#payroll]`).

**Why it hurts onboarding:** The two paths are mutually exclusive and both lead nowhere for payroll:
the SDK path hits the un-provisionable wall (#1 above); the docs path never touches `tee:payroll` and
has zero payroll guidance. A new team cannot tell which is the supported architecture.

**Repro:** Fetch `https://docs.terminal3.io/developers/adk/use-cases/payroll-agent` (empty stub) vs the
`get-started/walkthrough/*` pages (build a `z:<tid>:travel-contracts` contract) vs `index.d.ts` exports
(`buildPayrollInvocation`, `PAYROLL_FUNCTIONS_V1`).

**Suggested fix:** Publish a real payroll-agent walkthrough; commit to one authorization model; if
`tee:payroll` is internal, mark the SDK symbols accordingly.

---

## 3 · Built-in contracts execute under a `/contracts`-suffixed name; `getScriptVersion` 404s on the documented name
**FEEDBACK #27 · Category: bug · Severity: HIGH**

**What:** The name you sign into a delegation credential and read in the `NoGrant` error is
`tee:payroll` (logical), but the **executable** `script_name` is `tee:payroll/contracts`. The SDK's own
`getScriptVersion("tee:payroll")` returns **404 `No registered version`**; only the `/contracts`
form resolves (→ `5.2.0`). `script_version:"latest"` therefore cannot be resolved by `execute`.

**Why it hurts onboarding:** A developer naturally passes the documented `tee:payroll` (and `"latest"`)
to `execute`/`getScriptVersion` and gets an unexplained 404 with no hint that a `/contracts` suffix is
required. Same trap for `tee:org-data/contracts` (1.1.1), `tee:delegation/contracts` (2.0.1).

**Repro:** `getScriptVersion(getNodeUrl(), "tee:payroll")` → 404; `…("tee:payroll/contracts")` → 200,
`{current_version:"5.2.0"}`.

**Suggested fix:** Document the executable-vs-logical name split; make `getScriptVersion`/`execute`
accept the logical name; ship a `tee:payroll` constant.

---

## 4 · `buildPayroll*Invocation` returns `bigint` fields that `executeAndDecode` cannot serialize
**FEEDBACK #29 · Category: bug · Severity: HIGH**

**What:** `buildPayrollDirectInvocation` / `buildPayrollInvocation` return objects with `bigint`
fields (`batch_cap_cents`, auto-filled `individual_disbursement_threshold_cents`). Passing that object
straight to the SDK's own `executeAndDecode` throws **`TypeError: Do not know how to serialize a
BigInt`** — the builder's output is not consumable by the executor. There is no exported
wire-projection helper (parallels #15 for `signCustodial`).

**Why it hurts onboarding:** The two SDK functions meant to be used together are incompatible out of
the box; the developer must hand-project every `bigint` → decimal string to get a sendable body.

**Repro:** `executeAndDecode({…, input: buildPayrollDirectInvocation({request:{…, batch_cap_cents:1000000n}})})`
→ `TypeError: Do not know how to serialize a BigInt` (client-side). Hand-projecting to decimal strings
makes the node accept the body (it then reaches the authz layer — see #1).

**Suggested fix:** Serialize bigints per the wire convention inside `execute`, or export a documented
`toPayrollWireBody()` helper and show it in a payroll example.

---

## 5 · Omitting `baseUrl` silently targets PRODUCTION (not a broken/testnet client)
**FEEDBACK #10 / #20 · Category: bug · Severity: HIGH**

**What:** The SDK's default environment is `production`. A `T3nClient` built without `baseUrl` (exactly
the README "Ethereum Authentication" example) silently resolves to the **mainnet** node and dials
`https://cn-api.sg.prod.t3n.terminal3.io`. On a fresh process, *before any client is built*,
`getEnvironment() === "production"` and `getNodeUrl() === "https://cn-api.sg.prod.t3n.terminal3.io"`.

**Why it hurts onboarding:** A developer copy-pasting the documented example to experiment locally is
silently pointed at **production**. A safe-by-default SDK should default to testnet (or refuse without
an explicit selection), never silently to mainnet.

**Repro:** Run the README "Ethereum Authentication" block verbatim (no `baseUrl`) → failure references
the **prod** host (`…sg.prod…/status`, observed 503). Plus the API-level proof above.

**Suggested fix:** Default to testnet or require an explicit environment; make `baseUrl` required when
no `transport` is supplied.

---

## 6 · The organisation contract returns opaque HTTP 500 on bad input (vs payroll's clean typed 400s)
**FEEDBACK #31 · Category: bug · Severity: MEDIUM**

**What:** `tee:organisation/contracts@0.1.19` returns **HTTP 500 `internal_error`** (no `detail`, just a
`request_id`) for an unknown/missing `function_name` — including plausible guesses like `create` /
`create-organisation`. By contrast `tee:payroll/contracts` returns clean typed 400s (`NoGrant`, etc.).

**Why it hurts onboarding:** When the only contract that *might* create the organisation you need (#1)
panics into an opaque 500, error-driven discovery is impossible — you can't tell whether the function
name, the input shape, or your permissions are wrong.

**Repro:** `executeAndDecode({script_name:"tee:organisation/contracts", script_version:"0.1.19", function_name:"__nope__", input:{}})` → `500 {"code":"internal_error","request_id":"0567a017-…"}`.

**Suggested fix:** Validate `function_name`/input and return a typed 400 (`unknown function` /
`missing field …`); never 500 on bad input.

---

*Positive note (credit where due):* `tee:payroll/contracts` error envelopes are excellent — typed
`{code, detail, request_id}` — and the docs are now machine-readable via `llms.txt`/`llms-full.txt`
(a partial resolution of the earlier 403 bot-wall, FEEDBACK #1).
