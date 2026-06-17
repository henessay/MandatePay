# CLAUDE.md — MandatePay working notes

MandatePay — a CFO delegates recurring payroll payouts to an autonomous agent under a
strict, **signed, bounded** mandate, built on Terminal 3's Agent Auth / delegation SDK.
The agent never sees real bank account numbers, cannot exceed the mandate, and every payout
is written to an immutable, attested audit ledger. Built for the Terminal 3 Agent Dev Kit
bounty (deadline 22 Jun 2026).

## The one rule that makes this not-decoration
Deterministic enforcement (ceiling, allowlist, per-line caps, validity window, replay) lives
in the **CFO-signed delegation credential** (re-checked in-TEE) and the **on-chain mirror**
(`MandatePolicy.sol`). The **LLM is used ONLY** for (a) interpreting free-form HR updates into
computed payout deltas and (b) anomaly reasoning + natural-language escalation. The LLM
**proposes**; the deterministic layer **authorizes**. Never let the LLM authorize money.

## Architecture (monorepo)
- `packages/shared` — framework-agnostic TypeScript types shared by agent + web. **Home of the
  zero-PII types**: the agent's `EmployeePayoutContext` has *no field* for a real account number.
- `packages/agent` — mandate signing (delegation credential), the `DisbursementRail`
  abstraction + `MockStripeRail`/`T3PayrollRail`, and the LLM judgment layer.
- `packages/contracts` — Foundry. `MandatePolicy.sol` = on-chain defense-in-depth mirror
  (allowlist + ceiling + nonce/replay). **Non-load-bearing**: if the chain is down, TEE bounds
  still hold.
- `apps/web` — Next.js trust dashboard: mandate-signing UI, HR-intake, split-screen
  ("agent saw `{{account}}`" vs "bank received"), live ledger, attestation badge.

## Offline-first invariant
The whole thing runs with **zero network**: `MockStripeRail` (default), mocked LLM, SDK
`MockTransport`, mocked ledger. Swap to live via env (`MANDATEPAY_RAIL=t3-payroll`, real keys).
`pnpm -r test`, `pnpm -r build`, and `forge test` must stay green offline. See
`docs/PHASE1_PLAN.md` §3 for everything gated on a live node.

## Git & commit conventions (IMPORTANT — persists across sessions)
- **Commits are authored by the repo owner alone.** Do **NOT** add `Co-authored-by` trailers
  or any "Generated with / Co-Authored-By Claude" tool-attribution footer to commit messages
  or PR bodies. (`.claude/settings.json` sets `includeCoAuthoredBy: false` to enforce this
  from the harness side.)
- Work on a **neutrally-named branch** (`feature/mandate-core`), never a `claude/...` branch.
- **Conventional commits**: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Keep work-branch
  commits coherent — the owner squash-merges into `main` at the end.
- Never commit secrets. `.env` is gitignored; only `.env.example` (empty values) is tracked.

## Parallel deliverable — `FEEDBACK_T3.md`
Log **every** Terminal 3 SDK bug / doc-gap / onboarding-friction / workaround the moment it
happens (there's a separate bounty for it). Numbered entries with timestamp, category,
expected, actual, evidence, workaround. Volume + detail win it.

## Working agreement
Be direct and critical — flag weak spots and wasted effort plainly. Prefer small, verifiable
steps; show test output. End each step: stop, run tests, summarize, say what to verify. The
owner handles all deploys (testnet, Vercel, sandbox) and provides keys + node egress.
