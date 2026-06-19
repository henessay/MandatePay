# MandatePay

> **A CFO hands an autonomous agent a signed, bounded mandate it can read but cannot exceed —
> where you can watch, line by line, the agent reason over messy human instructions, never touch a
> real account number, get stopped cold by anomalies, and write every move to an attested ledger.**

Built on Terminal 3's Agent Dev Kit (Agent-Auth / delegation SDK) for the T3 ADK bounty.

> ⚠️ **Draft README** — narrative + architecture for review. Frontend copy and the deployed
> `MANDATE_POLICY_ADDRESS` are placeholders pending the owner.

---

## The problem

Terminal 3's thesis is *"give AI agents real-world capabilities without handing them raw PII."* Today,
to let an agent run payroll you typically hand it the employees' bank account numbers and trust it not
to misuse them, over-pay, or pay the wrong account. That's three failures waiting to happen: a leak, an
over-spend, and a fat-finger to an attacker's account.

MandatePay removes all three by construction.

## The one rule that makes this not decoration

Deterministic enforcement — **ceiling, allowlist, per-line caps, validity window, replay** — lives in
the **CFO-signed delegation credential** (re-checked in-TEE) and an **on-chain mirror**
(`MandatePolicy.sol`). The **LLM is used ONLY** to (a) interpret free-form HR updates into computed
payout deltas and (b) reason about anomalies and write the human-readable escalation. **The LLM
proposes; the deterministic layer authorizes. The LLM never moves money and never sees an account
number.**

---

## Architecture

```
  CFO (data owner)                          Autonomous agent (delegate)
        │                                            │
        │ 1. SIGN MANDATE                            │
        │    buildDelegationCredential →             │
        │    RFC-8785 JCS → EIP-191 sign             │
        ▼                                            │
  SignedMandate ───────────────────────────────────▶│
   (ceiling, allowlist, per-line cap,                │
    validity window, vc_id)                          │
                                                     ▼
                              2. JUDGMENT (LLM — claude-sonnet-4-6, ADVISORY)
                                 free-form HR text  →  structured payout deltas
                                 "Борис уволился; Кэрол на 0.5 ставки; sales +10%"
                                          │  (reviewable diff vs roster)
                                          ▼
                              3. DETERMINISTIC AUTHORIZATION (the gate)
                                 ├─ compute proposal from deltas (pure)
                                 ├─ anomaly halt (Δ vs baseline, account-changed)
                                 ├─ mandate bounds: ceiling / window / per-line
                                 └─ on-chain mirror: MandatePolicy.authorizeDisbursement
                                          │  (only READY lines, within bounds)
                                          ▼
                              4. DisbursementRail   ◀── the ONLY node-aware seam
                                 ├─ MockStripeRail (default)  ref → {{account}} our side
                                 └─ T3PayrollRail (live, gated on R1 — see below)
                                          │
                                          ▼
                              5. ATTESTED AUDIT LEDGER
                                 host-stamped immutable batches + tx_hash + TDX attestation badge
```

Zero-PII is **type-enforced**: the agent's `EmployeePayoutContext` has *no field* for a real account
number — only `recipientRef` (the opaque `bank_account_ref`). A runtime guard `assertNoRawAccount()`
throws if an IBAN/PAN/routing shape ever appears on the agent context. The real account exists **only**
inside the rail (mock vault) or the TEE — never in agent/shared/UI types.

---

## The honest mock ↔ live boundary

We are explicit about where the demo is real and where it is mocked — see
[`docs/R1_RESOLUTION.md`](docs/R1_RESOLUTION.md) for the full story.

| Layer | Demo | Real? |
|---|---|---|
| Mandate signing (JCS + EIP-191 + recover/verify) | ✅ | **Real** crypto, runs offline |
| LLM interpretation (claude-sonnet-4-6) | ✅ | **Real** Anthropic API (advisory only); EN **and** Russian free-form both parse correctly |
| Deterministic bounds (ceiling / window / per-line / anomaly halt) | ✅ | **Real**, fully tested |
| Agent-Auth on the live T3 node (handshake → SIWE → DID → grants) | ✅ | **Real** — `agent-auth-update` grants **committed on-chain** (`tx:302:44993`, `tx:302:44995`) |
| On-chain mirror `MandatePolicy.sol` | ✅ | **Real & deployed** — Sepolia [`0x6a68Cc67…32a5A1`](https://sepolia.etherscan.io/address/0x6a68Cc677c6bd10a39d3733Ea519ca093C32a5A1) (tx `0xd479…d836`); on-chain check wiring in progress |
| **Disbursement dispatch** | `MockStripeRail` | **Mocked, by design.** The built-in `tee:payroll` contract is un-provisionable on the sandbox (no way to create the required organisation — verified from 6 angles, `FEEDBACK_T3.md` #30/#32). `T3PayrollRail` encodes everything we confirmed live and *throws rather than guess* the unconfirmed response. |

This is a **final architectural position, not a stub:** disbursement is isolated behind one
`DisbursementRail` seam so the demo runs end-to-end offline while the trust/auth layer stays genuinely
live. Flipping `MANDATEPAY_RAIL=t3-payroll` is the only change needed once Terminal 3 ships an
org-provisioning path.

---

## How this maps to the judging criteria

**1 · Completeness / end-to-end.** A full vertical slice runs offline with zero network: CFO signs a
bounded mandate → agent interprets a messy HR update → deterministic layer computes, enforces bounds,
halts an anomaly → rail dispatches the safe lines → every move lands in the ledger. `pnpm -r test` and
`pnpm -r build` are green; `forge test` covers the on-chain mirror.

**2 · Depth of Agent-Auth / delegation SDK usage.** We exercise the SDK's flagship delegation surface
for real, not as decoration: `buildDelegationCredential` + RFC-8785 `canonicaliseCredential` +
`signCredential` (EIP-191) + `ethRecoverEip191` verify; live `handshake()` + Eth/SIWE `authenticate()`
against the testnet node; **on-chain `agent-auth-update` grants** (`tx:302:44993/95`); and a complete,
documented reconnaissance of the `tee:payroll` / `tee:org-data` / `tee:delegation` contracts to their
authorization layer — which surfaced six live, reproducible onboarding bugs
([`docs/BUG_REPORT_HEADLINE.md`](docs/BUG_REPORT_HEADLINE.md)). We hit the real edges of the SDK and
documented them.

**3 · Creativity / originality.** The payroll *plumbing* is Terminal 3's canonical example, so we
deliberately differentiate on three axes other teams won't (see
[`docs/DIFFERENTIATION.md`](docs/DIFFERENTIATION.md)):
- **An agent judgment layer** that does genuine work the deterministic layer can't — interpreting
  free-form, multilingual HR text into a reviewable payout diff, and explaining anomalies in plain
  language.
- **On-chain defense-in-depth:** `MandatePolicy.sol` re-enforces the same bounds from a second,
  independent trust root (public chain) in addition to the TEE credential.
- **Trust-visualization UX:** a split-screen showing exactly what the agent held (`{{account}}`) vs
  what the rail dispatched (masked account), backed by the *real* objects, plus a live attested ledger.

---

## Monorepo layout

```
packages/shared      framework-agnostic zero-PII types + runtime account-leak guard
packages/agent       mandate signing, DisbursementRail (+ Mock/T3 impls), LLM judgment layer
packages/contracts   MandatePolicy.sol (on-chain mirror) + Foundry tests
apps/web             Next.js trust dashboard (mandate UI, HR-intake, split-screen, ledger, attestation)
docs/                R1_RESOLUTION, BUG_REPORT_HEADLINE, DIFFERENTIATION, SDK_CAPABILITIES, plans
```

---

## Run it (offline-first — zero network by default)

```bash
pnpm install

# TypeScript tests (25 pass offline, no network):
pnpm --filter @mandatepay/shared --filter @mandatepay/agent test

# On-chain mirror tests (requires Foundry: https://getfoundry.sh):
cd packages/contracts && forge test

# Build everything:
pnpm -r build

# Trust dashboard → http://localhost:3000
pnpm --filter @mandatepay/web dev
```

### Rail switch (the only thing that changes to go live)

```bash
# .env  (copy from .env.example — never commit .env)
MANDATEPAY_RAIL=mock          # default, fully offline
# MANDATEPAY_RAIL=t3-payroll   # live tee:payroll node (gated on R1, see docs/R1_RESOLUTION.md)
```

### Real LLM interpreter (optional — defaults to a deterministic offline mock)

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# Two live runs (English + Russian free-form), strictly advisory:
set -a; . ./.env; set +a
pnpm --filter @mandatepay/agent exec vitest run src/judgment/interpret.live.test.ts
```

With no key, the agent runs on a deterministic mock interpreter so the whole demo still works offline.

---

## Status

- **Live & verified:** mandate signing, real Anthropic interpretation (EN + RU), deterministic bounds +
  anomaly halt, live T3 Agent-Auth (handshake/SIWE/DID + on-chain grants), `MandatePolicy` + tests.
- **Mocked by design:** disbursement dispatch (`MockStripeRail`) — see
  [`docs/R1_RESOLUTION.md`](docs/R1_RESOLUTION.md).
- **Deployed:** `MandatePolicy.sol` is live on **Sepolia** at
  [`0x6a68Cc677c6bd10a39d3733Ea519ca093C32a5A1`](https://sepolia.etherscan.io/address/0x6a68Cc677c6bd10a39d3733Ea519ca093C32a5A1)
  (deploy tx `0xd4791ee675ce7ece07aca3874f178663a453459ff741fa17c7acc735fb33d836`, owner
  `0xD69D9bBfFaeb2f4CD1c1C44cf6142712CacE7705`). Wiring the on-chain `authorizeDisbursement` check
  into the payout path is in progress.

```
MANDATE_POLICY_ADDRESS=0x6a68Cc677c6bd10a39d3733Ea519ca093C32a5A1   # Sepolia (chainId 11155111)
CHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

Parallel deliverable: the live SDK bug-hunt lives in [`FEEDBACK_T3.md`](FEEDBACK_T3.md) (32 entries),
with the submission-ready top six in [`docs/BUG_REPORT_HEADLINE.md`](docs/BUG_REPORT_HEADLINE.md).
