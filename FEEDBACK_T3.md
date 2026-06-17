# Terminal 3 SDK — Onboarding Bug & Docs-Gap Log

Running log of every bug, doc gap, onboarding friction point, and workaround hit while
building **MandatePay** on Terminal 3's Agent Dev Kit. Append immediately, smallest items
included. Format per entry: **timestamp · category · expected · actual · evidence · workaround**.

Categories: `bug` · `doc-gap` · `onboarding-friction` · `coming-soon-mismatch`

Environment: Linux container; Node v22.22.2; `@terminal3/t3n-sdk@3.7.0`; pnpm/Foundry target.

---

### #1 — 2026-06-17 · onboarding-friction · docs site unreachable, SDK is the only usable reference
- **Expected:** Read the get-started walkthrough, T3N Host API reference, and the
  `http-with-placeholders` page at `https://docs.terminal3.io/` (per the brief).
- **Actual:** Docs are unreachable from a normal automated/dev environment. `curl` is
  egress-blocked at the network policy; the markdown-rendering fetcher gets **HTTP 403
  Forbidden** on both `https://docs.terminal3.io/` and
  `https://docs.terminal3.io/t3n/developer-guide/developer-overview` (Cloudflare/JS bot wall).
- **Evidence:** `Host not in allowlist: docs.terminal3.io` (curl); `HTTP 403 Forbidden` (fetch).
- **Impact:** A developer onboarding via CI/agent/headless tooling cannot read the docs at all.
  Forces reverse-engineering from `index.d.ts`. (The `.d.ts` is *excellent* — see #2 — but it
  shouldn't be the only path.)
- **Workaround:** Treated the shipped SDK (`index.d.ts`, bundle, WIT stubs) as ground truth +
  one web search for the high-level model. **Ask:** publish a static/printable docs mirror, or
  loosen the bot wall for plain GETs / provide an `llms.txt`.

### #2 — 2026-06-17 · doc-gap (positive + gap) · README covers <40% of the real API surface
- **Expected:** The package README to introduce the flagship capabilities (agent-auth /
  delegation, payroll, audit ledger), since Terminal 3's headline use case *is* the payroll agent.
- **Actual:** README only documents handshake/auth + OTP/user-upsert. The **entire delegation +
  payroll system** (`buildDelegationCredential`, `buildPayrollInvocation`, `revokeDelegation`,
  `PAYROLL_FUNCTIONS_V1`, `DelegationCustodialClient`), **org-data**, **audit ledger**
  (`getAuditEvents`), and **TDX attestation** verifiers are absent from the README. They are
  *only* discoverable by reading `index.d.ts`.
- **Evidence:** README §"Quick Start"/"OTP-backed user flows" only; vs. 3,302-line `index.d.ts`
  exporting `buildDelegationCredential`, `buildPayrollInvocation`, `getAuditEvents`, etc.
- **Note:** The `index.d.ts` doc-comments are genuinely high quality (wire shapes, security
  notes, defaults). Surfacing even a fraction in the README would cut onboarding time hugely.
- **Workaround:** Wrote `docs/SDK_CAPABILITIES.md` from the type surface.

### #3 — 2026-06-17 · coming-soon-mismatch (in our favor) · "coming soon" capabilities are actually shipping
- **Expected (per brief):** `agent-auth`, `signing`, `did-registry`, `vp`, `outbox` flagged
  "coming soon"; risk of architecting on vapor.
- **Actual:** `agent-auth` (full delegation module) and `signing` (EOA + TEE-custodial) are
  **live and exported** in 3.7.0; DIDs are first-class. So the docs' "coming soon" labeling is
  **stale / inconsistent** with what the SDK ships.
- **Evidence:** `index.d.ts` exports `buildDelegationCredential`, `signCredential`,
  `DelegationCustodialClient`, `revokeDelegation`, `compactDidFromBytes`, etc.
- **Impact:** Positive for us, but the docs/SDK status mismatch will mislead other devs in
  both directions. **Ask:** a single authoritative capability-status matrix versioned with the SDK.

### #4 — 2026-06-17 · doc-gap · `http-with-placeholders` has no client-side symbol or mapping
- **Expected:** A discoverable client API (or at least a documented contract input) for the
  placeholder substitution the product is famous for.
- **Actual:** The strings `placeholder` / `http-with-placeholders` appear **nowhere** in the
  SDK (types, bundle, WIT). It's evidently a TEE/contract-internal step keyed off an opaque
  ref (`EmployeeRecord.bank_account_ref`), but nothing documents *how* a developer supplies the
  real account, how the ref→secret binding is provisioned, or which contract performs the swap.
- **Evidence:** `grep -ri placeholder dist/` → 0 hits; only `bank_account_ref` ("opaque
  reference used by the service layer for disbursement") hints at the mechanism.
- **Workaround:** Architecting around `bank_account_ref` as the boundary; flagged as **Risk R1**
  (must verify against a live node). **Ask:** document the ref-provisioning + substitution flow.

### #5 — 2026-06-17 · doc-gap · `becomeDevTenant` / testnet self-admit is the hidden onboarding switch
- **Expected:** A documented "how to get a usable testnet tenant + credits" path.
- **Actual:** The mechanism exists but is buried in a `submitUserInput` arg doc-comment:
  `becomeDevTenant: true` self-admits the DID as a testnet tenant and mints welcome credits
  (testnet-only; returns `tenantAdmit.status`). This is the de-facto onboarding step and is
  invisible unless you read the field's TSDoc.
- **Evidence:** `SubmitUserInputArgs.becomeDevTenant` TSDoc in `index.d.ts`.
- **Workaround:** Will call `runOtpThenUserInput({ ..., becomeDevTenant: true })` during setup.
  **Ask:** promote this to the get-started guide.

### #6 — 2026-06-17 · onboarding-friction · no published examples / demo file in the npm package
- **Expected:** An `examples/` dir or `demo.ts` in the tarball (the TSDoc references "demo.ts"
  and a "t3n-mcp" consumer).
- **Actual:** The package ships only `dist/`, `README.md`, `LICENSE`. Referenced examples
  (`demo.ts`, t3n-mcp `runPayroll` handler) are not included and the `Terminal-3/trinity` repo
  paths I tried (`raw.githubusercontent.com/.../client/t3n-sdk/README.md`) returned **404**
  (repo private or path differs).
- **Evidence:** tarball file list; GitHub raw 404.
- **Workaround:** Built a minimal offline smoke-test myself to validate the delegation chain
  (passed: 489-byte JCS, 65-byte EIP-191 sig, signer recovery matches). **Ask:** ship a runnable
  end-to-end payroll example, or make the trinity example path public.

### #7 — 2026-06-17 · onboarding-friction (minor) · `@noble/curves@2.x` peer import path trap
- **Expected:** `import { secp256k1 } from "@noble/curves/secp256k1"` (the v1 path) to work,
  since the SDK depends on `@noble/curves ^2.2.0`.
- **Actual:** Under `@noble/curves@2.x` that subpath is no longer exported
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`), so naive example code that derives the agent pubkey via
  noble breaks. Not the SDK's bug, but the SDK gives no helper to derive a **33-byte compressed
  secp256k1 agent pubkey** (needed for `buildDelegationCredential.agent_pubkey`), pushing devs
  to noble directly and into this trap.
- **Evidence:** `ERR_PACKAGE_PATH_NOT_EXPORTED: './secp256k1' is not defined by "exports"`.
- **Workaround:** Used the correct v2 entry; for the probe, supplied a synthetic 33-byte pubkey.
  **Ask:** export an `agent_keypair()` / `getAgentPublicKey(secret)` helper so app devs don't
  hand-roll the agent key with the right curve/encoding.
