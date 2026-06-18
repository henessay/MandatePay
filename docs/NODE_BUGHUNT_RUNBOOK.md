# Live-Node Bug-Hunt Runbook

**Purpose:** when the testnet node + API key + egress are available, systematically harvest
onboarding bugs and doc-gaps (the second prize), not just wire up features. The live node is
the richest bug surface — handshake, real contract wire shapes, error envelopes, attestation,
and docs-vs-reality. Work top to bottom; **log every finding as a new numbered entry in
`FEEDBACK_T3.md` (#27+)** using the same schema (Category · Severity · Concerns · Repro ·
Expected · Actual · Suggested fix). Capture the exact request/response JSON and the request id.

> Discipline: each probe lists **what to run**, **what to watch**, and **log a bug if**. Don't
> "make it work and move on" — when something is undocumented, surprising, or wrong, stop and
> write the entry first. Keep a scratch file of raw payloads; redact secrets before committing.

## 0. Setup & instrumentation (do first)
- [ ] `.env` from `.env.example`: `T3N_NODE_URL`, demo EOA key, `ANTHROPIC_API_KEY`. Confirm
      egress to the node host is allow-listed.
- [ ] Turn on SDK debug logging: `setGlobalLogLevel(LogLevel.DEBUG)` — capture every JSON-RPC
      envelope and `Set-Cookie`.
- [ ] Tee a proxy/log of all `/api/rpc` traffic (method, params, result/error, `request_id`).
- [ ] Record SDK + node versions (`GET /status`, `npm view @terminal3/t3n-sdk version`).
- [ ] **Log a bug if:** `/status` shape, debug-log format, or required headers differ from docs.

## 1. Handshake & transport
- [ ] Run the README Quick Start **verbatim** (only `EthSign` handler). → expect failure
      (FEEDBACK #9). Record the exact error/stack.
- [ ] Run again with `handlers: { ...createDefaultHandlers(baseUrl), EthSign: … }`. Confirm this
      is what's actually required.
- [ ] Omit `baseUrl` (README Eth-auth example, FEEDBACK #10). Record the failure mode.
- [ ] Node-fetch (no browser): confirm the cookie jar / `GCLB` session-affinity behavior; drop
      the cookie on a follow-up call and confirm the `401 session not found` described in
      `HttpTransport`.
- [ ] `loadWasmComponent()` with no `wasmPath` under Next/webpack/Vite (FEEDBACK #26). Does the
      bundled WASM resolve? What breaks without `serverExternalPackages`?
- [ ] **Log a bug if:** required handlers, cookie handling, or WASM resolution differ from docs;
      error messages are unactionable; handshake needs undocumented steps.

## 2. Authentication (Eth / OIDC / Email-OTP)
- [ ] Eth (SIWE) auth → confirm DID format `did:t3n:<40-hex>`.
- [ ] OIDC: verify the nonce round-trip — the node-minted nonce must reach the Google auth URL;
      deliberately submit a **mismatched** nonce and record the error type (FEEDBACK #17 context:
      is the failure typed or a raw string?).
- [ ] Email-OTP **login** via `authenticate(createEmailOtpAuthInput(...))` vs **contact-bind**
      via `otpRequest`/`otpVerify`. Confirm they're distinct; confirm same-email → same DID
      across Eth/OIDC/OTP (the "one identity" claim).
- [ ] `addAuthMethod` (link wallet to existing DID); `mergeProfiles` on a wallet↔email clash —
      confirm the `mergeSuggestion` flow.
- [ ] **Log a bug if:** DID resolution isn't stable across methods; nonce-mismatch isn't a typed
      error; OTP login vs bind behave surprisingly; merge requires undocumented preconditions.

## 3. Testnet tenant bootstrap & token metering
- [ ] `runOtpThenUserInput({ …, becomeDevTenant: true })` → inspect `tenantAdmit.status`
      (`admitted`/`already-admitted`/`refused`) and `grantedCredits` (FEEDBACK #5).
- [ ] `getUsage()` → confirm base-units convention; test a large value for the `number`
      precision concern (FEEDBACK #18). Does `formatTokens`/`toBaseUnits` round-trip?
- [ ] Exhaust credits → confirm the typed `InsufficientCreditError` surfaces (not a raw string).
- [ ] **Log a bug if:** self-admit is refused on testnet for undocumented reasons; amounts lose
      precision; credit-exhaustion isn't typed.

## 4. Delegation / agent-auth (our headline)
- [ ] **EOA path:** build + sign a credential offline (already done), then have the agent submit
      a delegated `buildPayrollInvocation` and confirm the TEE accepts the signatures + bounds.
- [ ] **Custodial path:** `DelegationCustodialClient.signCustodial(body)` — build the wire
      projection by hand (FEEDBACK #15: b64u binary fields, **decimal-string** secs). Record the
      exact rejection if the projection is off by one encoding.
- [ ] Bounds enforcement: attempt to exceed the ceiling / call a non-allowlisted function / use
      an expired window / replay a nonce → confirm the TEE rejects each, and capture the error
      shapes (these are gold for "the agent cannot widen the mandate").
- [ ] `revokeDelegation` (whole + per-function) → confirm `revokedFunctions` merge semantics and
      that a revoked credential is rejected.
- [ ] **Log a bug if:** the custodial wire shape isn't what the TSDoc implies; any bound is
      enforced inconsistently with the offline credential; revoke semantics surprise.

## 5. `tee:payroll` wire shapes — **R1, the #1 risk**
- [ ] `compute-payroll`: send a `PayrollRunRequest`; record the **exact decoded response JSON**
      (field names, types, where amounts/anomalies live).
- [ ] `execute-disbursement`: dispatch one line; record the response. **This replaces the
      TODO-marked mapping in `T3PayrollRail`** (`packages/agent/src/rails/t3Payroll.ts`,
      "WIRE FORMAT — UNCONFIRMED").
- [ ] Confirm the `bank_account_ref → real account` substitution: verify the agent's request
      carried only the ref/placeholder and the node resolved it server-side. Confirm whether the
      Stripe test-merchant rail is actually wired, or we drive Stripe test mode ourselves.
- [ ] `finalize-audit`, `submit-escalations`, `validate-credentials`: capture each response.
- [ ] **Log a bug if:** the wire shape is undocumented / differs from the SDK's general
      conventions; the ref-provisioning flow (how the TEE learns ref→account) isn't documented
      (FEEDBACK #4); function names differ from `PAYROLL_FUNCTIONS_V1` (FEEDBACK #12).

## 6. Org-data (roster + grants)
- [ ] `SessionOrgDataClient`: `createPolicy`/`setGrants`/`writeData`/`dataList`/`dataGet` for the
      roster scope. Confirm entry-id derivation (`SHA-256(org,scope,writer,seq)` vs explicit
      `entryId`).
- [ ] Authorization: call as a non-admin / non-writer → confirm the `'CODE: detail'` refusal
      string; is it typed or raw?
- [ ] Round-trip an `EmployeeRecord` (note the SG/CPF fields, FEEDBACK #24) and confirm
      `bank_account_ref` is stored opaquely.
- [ ] **Log a bug if:** grant/writer authorization errors are unactionable; entry-id derivation
      isn't reproducible; the SG/CPF fields are required for non-SG orgs.

## 7. Audit ledger
- [ ] `getAuditEvents()` after a delegated cycle → confirm host-stamped `subject`/`actor`/`vc_id`
      (agent as actor, org as subject, vc_id = credential) and that a contract **cannot** forge
      them.
- [ ] Delegated read scope: read another user's trail via `pii_did` and confirm it's admitted
      **only while the grant is live**; revoke and re-test.
- [ ] `AuditBatch.committed`: force a rolled-back dispatch and confirm `committed:false`.
- [ ] Merkle reality-check: confirm whether ANY client-side inclusion-proof object exists
      (R2). If not, the honest framing (immutable batches + tx ref + attestation) stands.
- [ ] **Log a bug if:** identity fields are forgeable/missing; delegated read scope leaks after
      revoke; `committed` is unreliable; a proof API exists but is undocumented.

## 8. Attestation (the trust badge)
- [ ] `fetchDkgAttestation(baseUrl)` then `verifyDkgAttestation(...)`; also a single
      `verifyTdxQuote` — construct `attestationMsg = encaps_key || sorted_peer_id_bytes` and see
      if the non-DKG case is documented (FEEDBACK #21).
- [ ] Pin `expectedRtmr3` and confirm a mismatch fails; confirm `fetchDkgAttestation` returns
      `undefined` while bootstrapping.
- [ ] Wire the result into the UI badge (replaces the mocked `attestationStatus()` in
      `apps/web/lib/demo.ts`).
- [ ] **Log a bug if:** `attestationMsg` construction is undocumented; verification needs
      undocumented inputs; there's no single-call node-verify helper.

## 9. Error envelopes & DX (sweep across all of the above)
- [ ] For every deliberate failure above, record: `RpcError.message`/`.detail`/`.requestId`,
      whether a **typed** subclass exists (e.g. `InsufficientCreditError`, `UserUpsertError`,
      `SessionExpiredError`), and whether `.message` alone is actionable.
- [ ] Trigger `SessionExpiredError` (let a SIWE session lapse mid-call) and confirm the re-auth
      branch works as documented.
- [ ] `decodeWasmErrorMessage`/`extractWasmError`: do raw WASM errors really arrive as the
      comma-separated byte arrays the SDK claims, and does the decoder handle them?
- [ ] **Log a bug if:** errors are raw strings where a typed class is implied; `request_id` is
      missing; messages don't match documented `'CODE: detail'` shapes; WASM errors aren't
      decoded.

## 10. Docs-vs-reality final sweep
- [ ] Re-run every README/TSDoc snippet verbatim against the live node and check each FEEDBACK
      entry #1–#26 still reproduces (or fix the entry with the live evidence).
- [ ] Note any capability the docs call "coming soon" that is actually live (FEEDBACK #3), and
      any "live" thing that 404s/erros.
- [ ] **Log a bug if:** any shipped example fails as written, or any doc statement contradicts
      observed behavior.

---

### Capture template (paste per finding into FEEDBACK_T3.md as #27+)
```
### #N — <title>
- Category: bug | doc-gap | onboarding-friction | type-issue | missing-example
- Severity: high | medium | low
- Concerns: <method / .d.ts line / endpoint / doc URL>
- Repro: <exact call + inputs>           (attach request/response JSON + request_id)
- Expected: ...
- Actual: ...
- Suggested fix: ...
```
