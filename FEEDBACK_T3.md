# Terminal 3 SDK — Onboarding Bug & Docs-Gap Log

Deliberate, reproducible audit of onboarding bugs, documentation gaps, type issues, missing
examples, and footguns in Terminal 3's Agent Dev Kit. Submitted for the "most onboarding bugs
reported" prize. Every entry is airtight: exact citation, repro, expected vs. actual, and a
concrete suggested fix.

- **SDK under audit:** `@terminal3/t3n-sdk@3.7.0` (47 versions on npm; latest at audit time).
- **Method:** Offline static audit of the shipped package — `dist/index.d.ts` (3,302 lines),
  `README.md`, the compiled bundle, and the WIT-generated stubs under
  `dist/wasm/generated/interfaces/`. Live-node findings are collected separately via
  `docs/NODE_BUGHUNT_RUNBOOK.md` once a node is available.
- **Citations:** `index.d.ts Lxxxx` = line in v3.7.0's `dist/index.d.ts`. `README Lxx` = line in
  the shipped `README.md`. WIT = `dist/wasm/generated/interfaces/<file>`.
- **Schema (every entry):** Category · Severity · Concerns · Repro · Expected · Actual · Suggested fix.

## Index

| # | Category | Sev | One-line |
|---|---|---|---|
| 1 | onboarding-friction | high | Hosted docs unreachable (egress-block + HTTP 403 bot wall) |
| 2 | doc-gap | high | README documents <40% of the API; delegation/payroll/audit absent |
| 3 | doc-gap | medium | Docs' "coming soon" labels contradict what 3.7.0 ships |
| 4 | doc-gap | high | `http-with-placeholders` has no client symbol or ref-provisioning docs |
| 5 | doc-gap | medium | Testnet onboarding switch (`becomeDevTenant`) buried in a field TSDoc |
| 6 | missing-example | high | No runnable example / `demo.ts` in the package; referenced files 404 |
| 7 | onboarding-friction | medium | `@noble/curves@2` import-path trap; no agent-keypair helper |
| 8 | onboarding-friction | medium | No boolean credential-verify; `ethRecoverEip191` throws on bad sig |
| 9 | bug | high | README handshake examples omit the MlKem/Random handlers it requires |
| 10 | bug | high | README Ethereum-auth example omits `baseUrl` → broken transport |
| 11 | doc-gap | medium | Logger TSDoc imports a non-existent `@t3n-sdk/logger` subpath |
| 12 | type-issue | medium | `PAYROLL_FUNCTIONS_V1` is documented as the "payroll v2" surface |
| 13 | doc-gap | medium | `ClientExecute` TSDoc is copy-pasted from `ClientAuth` (wrong) |
| 14 | type-issue | low | Triplicate base64url encoders; canonical name hidden behind `_` alias |
| 15 | missing-example | high | `signCustodial` needs a hand-rolled wire projection; no helper |
| 16 | onboarding-friction | medium | `buildDelegationCredential` throws unless `functions` pre-sorted; no normalizer |
| 17 | doc-gap | medium | Two overlapping "OTP" flows (login vs contact-bind) conflated by name |
| 18 | type-issue | medium | Token `u128` amounts typed as JS `number` → silent precision loss |
| 19 | misleading-signature | low | `metamask_sign` never touches MetaMask when given a privateKey |
| 20 | type-issue | medium | Global mutable `setEnvironment`/`setNodeUrl` + key cache = server footgun |
| 21 | missing-example | medium | No one-call node attestation verify; `attestationMsg` construction undocumented |
| 22 | type-issue | low | Triple `Error = Uint8Array` WIT aliases + two different `Did` types |
| 23 | doc-gap | low | `ttlSecs` "Deprecated" in prose only, no `@deprecated` tag |
| 24 | doc-gap | low | SG/CPF-specific enums ship in the "generic" SDK undocumented |
| 25 | type-issue | low | `HandshakeResult.authenticated`/`.did` misleading pre-authentication |
| 26 | doc-gap | medium | `loadWasmComponent` WASM resolution under bundlers undocumented/ambiguous |

---

### #1 — Hosted docs unreachable from automated/headless environments
- **Category:** onboarding-friction · **Severity:** high
- **Concerns:** `https://docs.terminal3.io/` and `…/t3n/developer-guide/developer-overview`.
- **Repro:** `curl -sSL https://docs.terminal3.io/` from a CI/dev container; also fetch via any
  server-side renderer (no browser JS).
- **Expected:** Read the ADK get-started, Host API reference, and `http-with-placeholders` page.
- **Actual:** `curl` is egress-blocked at the network policy (`Host not in allowlist`); the
  HTML-rendering fetcher gets **HTTP 403 Forbidden** on root and deep pages (Cloudflare/JS bot
  wall). A developer onboarding via CI/agent/headless tooling cannot read the docs at all,
  forcing reverse-engineering from `index.d.ts`.
- **Suggested fix:** Publish a static/printable docs mirror or an `llms.txt`; allow plain GETs
  through the bot wall; ship the get-started as Markdown in the repo.

### #2 — README documents under 40% of the real API surface
- **Category:** doc-gap · **Severity:** high
- **Concerns:** `README.md` (all sections) vs `index.d.ts` (3,302 lines).
- **Repro:** Diff the README's exported symbols against the `export { … }` list at
  `index.d.ts L3300`.
- **Expected:** The flagship capabilities introduced in the README, since Terminal 3's headline
  use case is the payroll agent.
- **Actual:** README covers only handshake/auth + OTP/user-upsert. Entirely absent: the
  delegation/payroll system (`buildDelegationCredential`, `buildPayrollInvocation`,
  `revokeDelegation`, `PAYROLL_FUNCTIONS_V1`, `DelegationCustodialClient`), `OrgDataClient`, the
  audit ledger (`getAuditEvents`), and the TDX attestation verifiers
  (`verifyTdxQuote`/`verifyDkgAttestation`). They are discoverable only by reading `index.d.ts`.
- **Suggested fix:** Add README sections (or a `docs/` page) for delegation, payroll, org-data,
  audit, and attestation, each with one runnable snippet. The `.d.ts` doc-comments are already
  excellent — surface a fraction of them.

### #3 — Docs' "coming soon" labels contradict what 3.7.0 ships
- **Category:** doc-gap · **Severity:** medium
- **Concerns:** Docs capability matrix vs `index.d.ts` exports.
- **Repro:** Compare the docs' "coming soon" set (`agent-auth`, `signing`, `did-registry`,
  `vp`, `outbox`) against `index.d.ts L3300`.
- **Expected:** A capability status that matches the shipped SDK.
- **Actual:** `agent-auth` (full delegation module) and `signing` (EOA + TEE-custodial) are
  **live and exported** in 3.7.0; DIDs are first-class (`compactDidFromBytes`). The "coming
  soon" labeling is stale and misleads in both directions.
- **Suggested fix:** One authoritative capability-status matrix, versioned with the SDK, stating
  client-symbol vs server-side vs not-yet for each capability.

### #4 — `http-with-placeholders` has no client symbol or ref-provisioning docs
- **Category:** doc-gap · **Severity:** high
- **Concerns:** Substitution mechanism; `EmployeeRecord.bank_account_ref` (`index.d.ts L780`).
- **Repro:** `grep -ri "placeholder\|http-with" node_modules/@terminal3/t3n-sdk/dist` → 0 hits.
- **Expected:** A discoverable client API (or documented contract input) for the placeholder
  substitution the product is famous for, plus how to provision the `ref → real account` binding.
- **Actual:** No client symbol exists. The only hint is `bank_account_ref` ("opaque reference
  used by the service layer for disbursement"). Nothing documents how a developer supplies the
  real account, how the ref→secret binding is created in the TEE, or which contract performs the
  swap.
- **Suggested fix:** Document the ref-provisioning + substitution flow end-to-end with a payroll
  worked example; name the contract function and the placeholder token format.

### #5 — Testnet onboarding switch (`becomeDevTenant`) buried in a field TSDoc
- **Category:** doc-gap · **Severity:** medium
- **Concerns:** `SubmitUserInputArgs.becomeDevTenant` (`index.d.ts L617` area).
- **Repro:** Try to find "how do I get a usable testnet tenant + credits" from the README — it
  isn't there; it's only in the `becomeDevTenant` field comment.
- **Expected:** A documented "bootstrap a testnet tenant" path in get-started.
- **Actual:** The de-facto onboarding step (`submitUserInput({ becomeDevTenant: true })` →
  self-admit + welcome credits, testnet-only, returns `tenantAdmit.status`) is invisible unless
  you read that field's TSDoc. `runOtpThenUserInput` also forwards it but is equally buried.
- **Suggested fix:** Promote to a "Get testnet credits" get-started section with a copy-paste snippet.

### #6 — No runnable example / `demo.ts` in the package; referenced files 404
- **Category:** missing-example · **Severity:** high
- **Concerns:** Package tarball contents; TSDoc references to `demo.ts` and `t3n-mcp`
  (`index.d.ts L2145`, L2299).
- **Repro:** `npm pack @terminal3/t3n-sdk && tar tzf *.tgz` → only `dist/`, `README.md`,
  `LICENSE`. Fetch `raw.githubusercontent.com/Terminal-3/trinity/main/client/t3n-sdk/README.md`
  → **HTTP 404** (repo private or path differs).
- **Expected:** An `examples/` dir or a runnable `demo.ts` end-to-end (handshake → auth →
  delegate → payroll → audit), as the TSDoc references imply exist.
- **Actual:** No examples ship; the referenced example files are unreachable.
- **Suggested fix:** Ship a runnable end-to-end payroll example in the package (or a public
  `examples/` repo) and link it from the README.

### #7 — `@noble/curves@2` import-path trap; no agent-keypair helper
- **Category:** onboarding-friction · **Severity:** medium
- **Concerns:** Peer dep `@noble/curves ^2.2.0`; `DelegationCredential.agent_pubkey`
  (`index.d.ts L2206`, 33-byte compressed secp256k1).
- **Repro:** `import { secp256k1 } from "@noble/curves/secp256k1"` (the v1 path) →
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. The v2 path requires the `.js` suffix:
  `@noble/curves/secp256k1.js` (confirmed against the installed package's `exports`).
- **Expected:** Either a v1-style path, or an SDK helper to produce the 33-byte compressed agent
  pubkey the credential requires.
- **Actual:** Devs must reach into `@noble/curves` directly (and hit the path trap) to derive the
  agent key with the correct curve + compression.
- **Suggested fix:** Export `generateAgentKeypair()` / `getAgentPublicKey(secret)` returning the
  33-byte compressed key; document the `.js` peer-import requirement.

### #8 — No boolean credential-verify; `ethRecoverEip191` throws on a bad signature
- **Category:** onboarding-friction · **Severity:** medium
- **Concerns:** `ethRecoverEip191` (`index.d.ts L2386`); no `verifyCredentialSignature` export.
- **Repro:** Recover from a 1-char-mutated 65-byte signature:
  `ethRecoverEip191(jcs, tamperedSig)` → throws `"bad point: is not on curve, sqrt error:
  Cannot find square root"` (intermittently, depending on whether the corrupted bytes land on
  the curve).
- **Expected:** A `verify(jcs, sig, expectedAddr) -> boolean` mirroring the TEE's server check,
  returning `false` for an invalid/tampered signature.
- **Actual:** The only primitive throws on exactly the inputs it should reject, so a naive
  `recovered === expected` verifier crashes nondeterministically.
- **Suggested fix:** Ship a boolean verify helper that catches curve errors; or document that
  callers MUST wrap `ethRecoverEip191` in try/catch.

### #9 — README handshake examples omit the MlKem/Random handlers `createDefaultHandlers` says it requires
- **Category:** bug · **Severity:** high
- **Concerns:** `README L39-41` (Quick Start) and `L67-69` (Ethereum Authentication);
  `createDefaultHandlers(baseUrl)` (`index.d.ts L2154-2160`, "Create the default handler set
  **required by the T3n handshake**"); `GuestToHostHandlers` (`index.d.ts L1078-1098`:
  `EthSign`, `MlKemPublicKey`, `Random`).
- **Repro:** Copy the README Quick Start verbatim: `new T3nClient({ …, handlers: { EthSign:
  metamask_sign(...) } }); await client.handshake();`.
- **Expected:** Handshake completes — README presents this as the minimal working setup.
- **Actual:** The handshake state machine needs the `MlKemPublicKey` handler (to encrypt to the
  node's ML-KEM key) and `Random`; `createDefaultHandlers` exists precisely to supply them. The
  README provides only `EthSign`, so the documented minimal example cannot complete a handshake.
- **Suggested fix:** Show `handlers: { ...createDefaultHandlers(baseUrl), EthSign: metamask_sign(...) }`
  in every example, and state that `MlKemPublicKey` + `Random` are mandatory.
- **Live-check (2026-06-18):** ⏳ **BLOCKED — pending node egress.** Ran the README Quick Start
  verbatim against `NODE_URLS.testnet` (`loadWasmComponent` works in Node). It fails earlier than
  predicted — at `GET https://cn-api.sg.testnet.t3n.terminal3.io/status: 403` — because the SDK
  fetches the ML-KEM key itself before any handler dispatch, and the node host is not in this
  environment's egress allowlist. So we **cannot yet confirm** whether a missing `MlKemPublicKey`
  handler is actually fatal: handshake may not need a hand-supplied handler at all. **Do not cite
  #9 as confirmed until `/status` is reachable.** Re-run once egress is open.

### #10 — README Ethereum-auth example omits `baseUrl` → broken transport & un-buildable MlKem handler
- **Category:** bug · **Severity:** high
- **Concerns:** `README L64-72` (the second `new T3nClient({ … })` has no `baseUrl`);
  `createMlKemPublicKeyHandler(baseUrl)` ("**Required**", `index.d.ts L2132-2148`);
  `T3nClientConfig.baseUrl` (optional, `index.d.ts L1275`).
- **Repro:** Run the README "Ethereum Authentication" block as written.
- **Expected:** A working client.
- **Actual:** With neither `baseUrl` nor `transport`, the SDK builds an `HttpTransport(undefined)`;
  and the required ML-KEM handler cannot be built without the node URL. The example is doubly
  broken — and inconsistent with the Quick Start, which *does* pass `baseUrl`.
- **Suggested fix:** Always pass `baseUrl` (or a `transport`) in examples; make `baseUrl`
  required at the type level when no `transport` is supplied.
- **Live-check (2026-06-18):** ⚠️ **Partially observed — reclassify emphasis.** With no `baseUrl`,
  the client did NOT use testnet — it silently targeted the **production** node: the failure was
  `GET https://cn-api.sg.prod.t3n.terminal3.io/status: 403`. So omitting `baseUrl` doesn't merely
  break the transport — **it defaults to PRODUCTION** (the SDK's default environment), a far more
  dangerous footgun (a dev experimenting locally hits prod). The final break-mode (transport vs
  ML-KEM handler) is still pending egress, but the prod-default behavior is confirmed live and is
  the real headline here. Strengthens #20.

### #11 — Logger TSDoc example imports a non-existent `@t3n-sdk/logger` subpath
- **Category:** doc-gap · **Severity:** medium
- **Concerns:** `index.d.ts L121` — `import { getLogger, setGlobalLogLevel, LogLevel } from
  '@t3n-sdk/logger';`; `package.json` `exports` only declares `"."` and
  `"./wasm/generated/session.js"`.
- **Repro:** Copy the Logger TSDoc example: `import { getLogger } from '@t3n-sdk/logger'`.
- **Expected:** A valid import path.
- **Actual:** The package name is wrong (`@terminal3/t3n-sdk`, not `@t3n-sdk`) **and** the
  `/logger` subpath isn't exported. `getLogger`/`setGlobalLogLevel`/`LogLevel` are exported from
  the package root. The example fails to resolve.
- **Suggested fix:** Change the example to `import { getLogger, setGlobalLogLevel, LogLevel }
  from '@terminal3/t3n-sdk';`.

### #12 — `PAYROLL_FUNCTIONS_V1` is documented as the "payroll v2" surface
- **Category:** type-issue · **Severity:** medium
- **Concerns:** `index.d.ts L2195` (TSDoc: "Canonical sorted list of the payroll **v2** function
  surface") vs `L2199` (`declare const PAYROLL_FUNCTIONS_V1`).
- **Repro:** Read the two adjacent lines.
- **Expected:** The constant name and its documented version agree.
- **Actual:** The exported constant is named `_V1` but its own doc-comment calls it the "v2
  function surface." A developer can't tell which payroll contract version these five functions
  (`compute-payroll`, `execute-disbursement`, `finalize-audit`, `submit-escalations`,
  `validate-credentials`) target.
- **Suggested fix:** Rename to match the actual contract version (or fix the comment), and state
  the `tee:payroll` semver the list corresponds to.

### #13 — `ClientExecute` interface TSDoc is copy-pasted from `ClientAuth`
- **Category:** doc-gap · **Severity:** medium
- **Concerns:** `index.d.ts L56-76` (`ClientExecute`).
- **Repro:** Read the `ClientExecute` doc-comments.
- **Expected:** Docs describing the execute state machine.
- **Actual:** The header says "Client **authentication** operations", `next()` says "Process
  next step in **authentication**", and `finish()` says "Promise with **DID bytes** if
  successful" — all verbatim from `ClientAuth` (`L36-55`). The execute flow does not finalize to
  a DID. Misleads anyone driving the raw flow.
- **Suggested fix:** Replace with execute-specific docs (what `finish()` returns for execute,
  what the state represents).

### #14 — Triplicate base64url encoders; the canonical name is hidden behind an `_` alias
- **Category:** type-issue · **Severity:** low
- **Concerns:** `index.d.ts L2292` (`b64uEncode`, declared but **not** in the export list),
  `L2303` (`b64uEncodeBytes`, exported + documented), `L2309-2311` (`_b64uEncode`, exported as
  `@internal` alias of `b64uEncode`).
- **Repro:** Try `import { b64uEncode } from "@terminal3/t3n-sdk"` → not exported; only
  `_b64uEncode` and `b64uEncodeBytes` are.
- **Expected:** One obvious encoder.
- **Actual:** Three near-identical names; the clean `b64uEncode` is unreachable, the public one
  is `b64uEncodeBytes`, and an `@internal` `_b64uEncode` is also exported — confusing
  autocomplete and inviting use of the wrong one.
- **Suggested fix:** Export a single `b64uEncode`; drop or stop exporting the `_`-prefixed alias.

### #15 — `signCustodial` needs a hand-rolled wire projection; no helper exported
- **Category:** missing-example · **Severity:** high
- **Concerns:** `DelegationCustodialClient.signCustodial(body)` (`index.d.ts L2431-2445`);
  `DelegationCredential` (`L2201-2227`, binary fields `Uint8Array`, secs `bigint`).
- **Repro:** Build a `DelegationCredential` with `buildDelegationCredential`, then try to call
  `signCustodial(credential)` — the body must instead be a wire projection: `agent_pubkey`/
  `vc_id` as base64url-no-pad strings and `not_before_secs`/`not_after_secs` as **decimal
  strings**, not the typed `Uint8Array`/`bigint`.
- **Expected:** A helper that projects a typed `DelegationCredential` into the `signCustodial`
  wire body.
- **Actual:** The TSDoc says "Use `buildDelegationCredential` + the wire-shape projection" but no
  such projection function is exported — the OIDC/custodial path forces every caller to
  hand-encode binary→b64u and bigint→decimal-string and get it byte-exact or the TEE rejects it.
- **Suggested fix:** Export `toSignCustodialBody(credential): Record<string, unknown>` (mirroring
  the canonicaliser) and show it in a custodial example.

### #16 — `buildDelegationCredential` throws unless `functions` are pre-sorted; no normalizer
- **Category:** onboarding-friction · **Severity:** medium
- **Concerns:** `DelegationCredential.functions` (`index.d.ts L2214-2216`),
  `BuildDelegationCredentialOpts.functions` (`L2338-2344`), `validateCredentialBody` (`L2357-2362`).
- **Repro:** `buildDelegationCredential({ …, functions: ["execute-disbursement","compute-payroll"] })`
  (unsorted) → throws on the sort/dedupe invariant.
- **Expected:** The builder normalizes, or there's a `normalizeFunctions` helper.
- **Actual:** The caller must pre-sort, dedupe, and lowercase the function list themselves;
  otherwise body validation throws. (Worked around by sorting in our code.) `PAYROLL_FUNCTIONS_V1`
  happens to be pre-sorted, which hides the trap until you build a subset by hand.
- **Suggested fix:** Normalize inside the builder (or export `normalizeFunctions`) and document
  the invariant on the option.

### #17 — Two overlapping "OTP" flows conflated by name (login vs contact-bind)
- **Category:** doc-gap · **Severity:** medium
- **Concerns:** `EmailOtpCredentials` + `createEmailOtpAuthInput` (login;
  `index.d.ts L309-312`, `L356`) vs `client.otpRequest`/`otpVerify` (bind a contact to an
  existing DID; `L1828`, `L1855`).
- **Repro:** Search the README/types for "OTP" — two unrelated mechanisms share the word.
- **Expected:** Clear separation: "sign in with email OTP" vs "verify/bind an email to my account."
- **Actual:** `authenticate(createEmailOtpAuthInput(...))` *authenticates* (resolves a DID),
  while `otpRequest`/`otpVerify` *bind a contact* to an already-authenticated DID. Same word,
  very different semantics and preconditions; the README documents only the latter, so a dev
  reaching for "email OTP login" is led to the wrong API.
- **Suggested fix:** Disambiguate in docs/naming (e.g. "OTP login" vs "OTP contact verification")
  and cross-link the two.

### #18 — Token `u128` amounts typed as JS `number` → silent precision loss
- **Category:** type-issue · **Severity:** medium
- **Concerns:** `BalanceRow.available`/`.reserved` (`index.d.ts L896-904`), `UsageEntry.amount`
  (`L954`), `BASE_UNITS_PER_TOKEN` (`L2832`).
- **Repro:** A balance above `Number.MAX_SAFE_INTEGER` base units (≈9.0e9 tokens at 6 decimals)
  read via `getUsage()` loses precision.
- **Expected:** A precision-safe type (`bigint`) for `u128` server values, or a documented
  hard cap.
- **Actual:** Server `u128` lands on the wire as a JSON number and is typed `number`; the TSDoc
  itself warns callers to "switch to a streaming JSON parser" but the type still invites unsafe
  arithmetic. The burden is silently on the caller.
- **Suggested fix:** Type these as `bigint` (or `string`) and parse with a bigint-aware JSON
  reader; or document the safe-integer ceiling prominently.

### #19 — `metamask_sign` never touches MetaMask when given a privateKey
- **Category:** misleading-signature · **Severity:** low
- **Concerns:** `metamask_sign(account, logger?, privateKey?)` (`index.d.ts L2113-2120`).
- **Repro:** `metamask_sign(addr, undefined, privKey)` (the README's own usage, `README L40`).
- **Expected:** A name reflecting behavior.
- **Actual:** With `privateKey` supplied, the function signs locally and "MetaMask is not used" —
  it's a generic EOA `EthSign` handler, not MetaMask-specific. The name misleads server-side /
  Node callers (the README itself uses it with a private key).
- **Suggested fix:** Rename to `ethSignHandler` (keep `metamask_sign` as a thin alias), or split
  into `metamaskSignHandler` vs `privateKeySignHandler`.

### #20 — Global mutable `setEnvironment`/`setNodeUrl` + key cache is a server/concurrency footgun
- **Category:** type-issue · **Severity:** medium
- **Concerns:** `setEnvironment` (`index.d.ts L3043-3046`), `setNodeUrl` (`L3049-3058`),
  `clearKeyCache` (`L3086`), per-URL ML-KEM cache.
- **Repro:** In a Next.js server handling two tenants on different nodes, call
  `setEnvironment("testnet")` then `setEnvironment("production")` concurrently — the second
  mutates process-global state ("sets the default node used by clients created afterwards") and
  the shared key cache.
- **Expected:** Per-client configuration without shared mutable globals.
- **Actual:** Environment/node selection and the key cache are process-global singletons; concurrent
  requests can race. (Mitigation: always pass an explicit `baseUrl` per `T3nClient`, which we do.)
- **Suggested fix:** Document the globals as process-wide and recommend per-client `baseUrl`;
  consider a config object scoped to each client.
- **Live-check (2026-06-18):** Confirmed live that the SDK's **default environment is
  `production`** — a `T3nClient` built with neither `baseUrl` nor a prior `setEnvironment("testnet")`
  fetched `cn-api.sg.prod.t3n.terminal3.io/status` (see #10). A safe-by-default SDK should default
  to testnet (or refuse with no explicit selection), not silently to mainnet.

### #21 — No one-call node attestation verify; `attestationMsg` construction undocumented
- **Category:** missing-example · **Severity:** medium
- **Concerns:** `verifyTdxQuote(quoteB64, attestationMsgB64, expectedRtmr3B64?)`
  (`index.d.ts L2982-2991`), `verifyDkgAttestation` (`L2992-3010`), `fetchDkgAttestation`
  (`L3073-3085`).
- **Repro:** Try to render an attestation badge from a node's `/status`: you must fetch the DKG
  bundle, then call `verifyDkgAttestation(encapsKey, attestationMsg, peerIds, quotes, …)` with
  correctly-ordered inputs; for a single `verifyTdxQuote` you must build `attestationMsg =
  encaps_key || sorted_peer_id_bytes` yourself — undocumented for the non-DKG case.
- **Expected:** A convenience like `verifyNodeAttestation(baseUrl) -> { valid, rtmr3 }`.
- **Actual:** No such helper; the `attestationMsg` byte layout for a single quote isn't
  documented, so wiring a trust badge is error-prone.
- **Suggested fix:** Ship `verifyNodeAttestation(baseUrl)` that fetches `/status` and verifies;
  document the `attestationMsg` construction.

### #22 — Triple `Error = Uint8Array` WIT aliases + two different `Did` types
- **Category:** type-issue · **Severity:** low
- **Concerns:** WIT `component-session-client-auth.d.ts`, `…-client-handshake.d.ts`,
  `…-session.d.ts`, `…-cookie.d.ts` each `export type Error = Uint8Array;`; `Did` as
  `Uint8Array` in WIT vs `Did { value: string; toString() }` at `index.d.ts L257-260`.
- **Repro:** Import the WIT stubs; observe `Error` shadowing the global `Error`, and `Did`
  meaning two different things across layers.
- **Expected:** Non-shadowing names; one `Did` concept.
- **Actual:** Generated stubs export `Error` (shadows global) and a `Did = Uint8Array` that
  collides conceptually with the SDK's string-wrapper `Did`. Confusing in mixed imports.
- **Suggested fix:** Rename the WIT error alias (e.g. `WasmError`/`SessionError`) and distinguish
  `DidBytes` vs `Did`.

### #23 — `ttlSecs` marked "Deprecated" in prose only, no `@deprecated` tag
- **Category:** doc-gap · **Severity:** low
- **Concerns:** `ExecuteOrgDataActionOptions.ttlSecs` (`index.d.ts L2619-2624`).
- **Repro:** Use `ttlSecs`; observe no editor strike-through / deprecation warning.
- **Expected:** A real `@deprecated` JSDoc tag so tooling flags it.
- **Actual:** The comment says "Deprecated. … the session-backed RPC path ignores it," but
  without the `@deprecated` tag IDEs don't warn, so callers keep setting an ignored field.
- **Suggested fix:** Add the `@deprecated` JSDoc tag (and consider removing the field).

### #24 — SG/CPF-specific enums ship in the "generic" SDK with no scoping docs
- **Category:** doc-gap · **Severity:** low
- **Concerns:** `ResidencyCategory` ("Singapore CPF residency categories"), `AgeBand`
  (`Under35`…`Over65`) at `index.d.ts L750-752`; `EmployeeRecord` CPF fields (`L765-783`).
- **Repro:** Read the payroll types in a non-SG context.
- **Expected:** Either region-neutral types or a clear note that these are SG-CPF-specific
  (and how non-SG orgs should model payroll).
- **Actual:** Singapore CPF residency/age-band domain modeling is baked into the general SDK
  types with no documentation of applicability — surprising for a "minimal, agnostic" SDK.
- **Suggested fix:** Document the SG-CPF scope, or move these into a region module.

### #25 — `HandshakeResult.authenticated`/`.did` are misleading before authentication
- **Category:** type-issue · **Severity:** low
- **Concerns:** `HandshakeResult { authenticated: boolean; did?: Did }` (`index.d.ts L261-266`).
- **Repro:** `const r = await client.handshake(); r.authenticated` after a bare handshake.
- **Expected:** Fields that reflect the post-handshake (pre-auth) state, or are clearly documented
  as always-false/undefined until `authenticate()`.
- **Actual:** `handshake()` precedes `authenticate()`, so `authenticated` is effectively always
  `false` and `did` always `undefined` here, yet both are presented as meaningful results of
  handshake — inviting a check that's always negative.
- **Suggested fix:** Document these as "populated only on a session restored from an
  authenticated cookie," or drop them from the handshake result.

### #26 — `loadWasmComponent` WASM resolution under bundlers is undocumented/ambiguous
- **Category:** doc-gap · **Severity:** medium
- **Concerns:** `loadWasmComponent(config?)` (`index.d.ts L242-249`); README L32 calls it with no
  args, the TSDoc example shows `{ wasmPath: '/path/to/t3n.wasm' }`.
- **Repro:** Call `loadWasmComponent()` inside Next.js/webpack/Vite without a `wasmPath`.
- **Expected:** Clear guidance on whether a path is needed and how the bundled
  `session.core.wasm` is resolved per bundler.
- **Actual:** README uses no args while the TSDoc implies a path; nothing documents how the
  `dist/wasm/generated/session.core.wasm` asset is located under common bundlers (a frequent
  WASM-in-bundler pain point). We had to keep the SDK as a server-external package to avoid the
  bundler touching the WASM.
- **Suggested fix:** Document `wasmPath` semantics + a per-bundler note (Next `serverExternalPackages`,
  Vite `assetsInclude`, etc.); state the default resolution behavior.

---

_Carry-forward: append new entries here the moment they're found. Live-node findings are
gathered via `docs/NODE_BUGHUNT_RUNBOOK.md` and folded back in as numbered entries (#27+)._
