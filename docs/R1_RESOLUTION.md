# R1 Resolution — why disbursement runs on `MockStripeRail` (final architecture)

**Status:** FINAL architectural position, not a temporary stub.
**Date:** 2026-06-18 · **Node:** `https://cn-api.sg.testnet.t3n.terminal3.io` (testnet, `phase=ready`)
**SDK:** `@terminal3/t3n-sdk@3.7.0` · **Demo tenant DID:** `did:t3n:cb2c…542e` (20,000 credits)

## TL;DR

The built-in **`tee:payroll`** contract — the one the SDK exposes via `buildPayrollInvocation` /
`PAYROLL_FUNCTIONS_V1` — requires an **organisation** to authorize any call. **There is no way for a
sandbox developer to create that organisation** — not via the client SDK, the sandbox dashboard, the
docs, the OpenAPI, the documented `agent-auth-update` grant, or the registered `tee:organisation`
contract. We verified this against the live node from every angle (evidence below).

T3's **documented** developer model is different: you write your **own** TEE contract in your tenant
namespace (`z:<tid>:…`) and authorize it with **`agent-auth-update`**. There is no built-in payroll
walkthrough at all (the flagship "Payroll Agent" doc page is an empty stub).

So MandatePay does the honest, idiomatic thing: it isolates the money-moving step behind a single
**`DisbursementRail`** seam and ships the demo on **`MockStripeRail`**, while keeping the
**Agent-Auth layer real** — our agent-auth grants are signed and **committed on-chain** against the
live node (`tx:302:44993`, `tx:302:44995`). The boundary is explicit and inspectable, not hand-waved.

---

## The R1 risk

R1 (the project's #1 risk from day one): *confirm the real `tee:payroll` `execute-disbursement` wire
response against a live node, and replace the TODO mapping in `T3PayrollRail` with it.* Everything
downstream of that — the "bank received the real IBAN" half of the split-screen — depends on it.

## What we verified against the live node (the wall)

Authenticated via Eth/SIWE (DID confirmed, 20k credits read via `getUsage`). We then drove the
`tee:payroll` flow to its authorization boundary and tried every available route to get past it. Each
row is a real call with a node `request_id` (full transcript in `FEEDBACK_T3.md` #27–#32; probes under
`packages/agent/scripts/r1-*.mjs`).

| Step | Call | Result | Evidence |
|---|---|---|---|
| Resolve contract | `getScriptVersion("tee:payroll")` | **404** `No registered version` | the logical name 404s; `tee:payroll/contracts` → **5.2.0** (#27) |
| `compute-payroll` | `executeAndDecode` (correct name+shape) | **400 `NoGrant: no grant exists for this user on tee:payroll`** | req `8486af2c-…` — request shape *accepted*, hit authz |
| org-data grant | `setGrants(org = own DID)` | **400 `OrgPolicyNotInitialised`** | req `83859e1c-…` |
| org-data policy | `createPolicy(org = own DID)` | **400 `OrganisationNotFound: organisation does not exist`** | req `f1491d24-…` |
| org contract | `tee:organisation/contracts@0.1.19` (any fn) | **500 `internal_error`** (opaque) | req `0567a017-…` (#31) |
| **agent-auth (documented path)** | `tee:user/contracts` `agent-auth-update` self-grant on `tee:payroll` | **200 — committed on-chain** | **`tx:302:44993`, `tx:302:44995`** |
| retry after agent-auth | `compute-payroll` | **still 400 `NoGrant`** | req `a334321b-…`, `e88e3c3b-…` |
| OpenAPI | `GET /api-reference/openapi.json` | **404 `Asset not found`** | no admin/org endpoint anywhere |
| SDK surface | (static) | **no org-create method** | only hints: `submitUserInput.organisationDid?`, `TenantClient.executeControl` |
| Sandbox dashboard | (owner-confirmed) | **no org creation** | only API-key + DID issuance + docs link |

**The decisive result:** the documented `agent-auth-update` self-grant *commits on-chain*
(`tx:302:44993/95`) but **does not clear** `tee:payroll`'s `NoGrant`. Agent-auth (the egress grant for
your own `z:` contracts) is a **different authorization layer** from `tee:payroll`'s `OrgContractGrant`.
The grant `tee:payroll` actually wants can only be set on an **initialised org-data policy**, which
requires an **organisation**, which **cannot be created**. Dead end, confirmed from six directions.

## The contradiction (why this is a real platform gap, not our mistake)

There are two incompatible stories in Terminal 3's own surface:

- **The SDK** ships `tee:payroll`, `PAYROLL_FUNCTIONS_V1`, `buildPayrollInvocation`,
  `buildPayrollDirectInvocation`, `EmployeeRecord` as first-class — strongly implying you *invoke the
  built-in payroll contract*. Following this path hits the un-provisionable `tee:payroll` wall (#30).
- **The docs** teach a different model: claim a `did:t3n`, **write your own** TEE contract under
  `z:<tid>:…`, authorize it via `tee:user/contracts agent-auth-update`, and invoke that. The only
  worked walkthrough is a *travel* (Duffel) contract; the "Payroll Agent" use-case page is an empty
  stub that just links elsewhere. A developer following the docs never touches `tee:payroll` (#32).

A team building "the payroll agent" — Terminal 3's own headline use case — cannot follow either path
to a working built-in payout on the sandbox.

## Our architectural decision

We do **not** guess the `execute-disbursement` wire shape (we'd be inventing a contract response).
Instead the architecture already anticipated this exact uncertainty — it was R1 from the start — and
isolates it behind one seam:

```
EmployeePayoutContext (zero-PII)
        │  recipientRef = opaque bank_account_ref (never an IBAN/PAN)
        ▼
   DisbursementRail            ← the ONLY thing that knows about the node
   ├── MockStripeRail (default, MANDATEPAY_RAIL=mock)   ← demo runs here
   │     • does the bank_account_ref → {{account}} substitution OUR side,
   │       same placeholder pattern, against a local fixture vault
   └── T3PayrollRail (MANDATEPAY_RAIL=t3-payroll)        ← live, gated on R1
         • encodes everything we DID confirm: script_name tee:payroll/contracts,
           concrete semver, bigint→decimal-string wire (#27/#29)
         • throws (does not guess) on the unconfirmed execute-disbursement response
```

- **The disbursement rail is mock; the trust/auth layer is real.** Mandate signing (EIP-191 over the
  RFC-8785 JCS credential), recovery/verification, the validity window, the on-chain `MandatePolicy`
  mirror, and the **agent-auth grants committed live on-chain** (`tx:302:44993/95`) are all genuine.
- **Zero-PII is enforced by construction, not discipline.** `EmployeePayoutContext` has *no field* for
  a real account number; `assertNoRawAccount()` throws on IBAN/PAN/routing shapes in the payout path.
- **The split-screen reads real objects:** left = the agent's actual `EmployeePayoutContext`
  (`{{account}}` / the ref), right = the actual `DispatchReceipt` from the rail (masked account). The
  contrast is not hardcoded.

When Terminal 3 ships an org-provisioning path (or confirms a hidden one), flipping
`MANDATEPAY_RAIL=t3-payroll` is the **only** change needed — we capture the real response, replace the
one TODO-marked block in `T3PayrollRail`, and nothing else in the agent or UI changes.

## Why this is the honest, stronger position

"Trust us, it's in the TEE" is not a demo. We made the boundary **inspectable**: the rail seam, the
zero-PII types, the runtime guard, and a real on-chain auth layer with transaction hashes. The R1
blocker is itself evidence of depth — we drove Terminal 3's flagship contract to its authorization
layer, produced real grants, and found a genuine onboarding gap that we can document precisely for
their devrel team. That is a more credible submission than a faked payout.

## What would unblock the live rail

1. A documented or SDK-exposed way to **create an organisation** and obtain its DID (then:
   `createPolicy` → `setGrants(tee:payroll, PAYROLL_FUNCTIONS_V1)` → write roster → `compute-payroll`
   → `execute-disbursement`, capturing the response).
2. **OR** confirmation that the built-in `tee:payroll` is internal-only and the supported path is a
   tenant-owned `z:<tid>:payroll` contract (then we register our own and re-point the rail).

Tracked in `FEEDBACK_T3.md` #30 (headline) and #32; summarized for submission in
`docs/BUG_REPORT_HEADLINE.md`. Escalation to `devrel@terminal3.io` is the open action.

## References

- `FEEDBACK_T3.md` — #27 (`/contracts` name split), #29 (bigint wire), #30 (org un-provisionable,
  headline), #31 (`tee:organisation` 500), #32 (SDK-vs-docs contradiction).
- Probes: `packages/agent/scripts/r1-probe.mjs`, `r1-payroll.mjs`, `r1-setup.mjs`, `r1-org-probe.mjs`,
  `r1-grant.mjs` (all read creds from `.env`, no secrets committed).
- `docs/PHASE1_PLAN.md` §3 (the live-node checklist this resolves) · `docs/SDK_CAPABILITIES.md` §6/§10.
