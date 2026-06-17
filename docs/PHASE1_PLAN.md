# Phase 1 Plan — Offline-First Build & Live-Node Checklist

**Date:** 2026-06-17 · **Branch:** `feature/mandate-core`

Phase 1 builds the entire MandatePay system so it runs **end-to-end offline** (mock rails,
mocked LLM, `MockTransport`, mocked ledger) with **zero network**. Everything that genuinely
needs a live T3N node is parked behind a clearly-marked boundary and listed in §3 for when
the human is at the computer with the API key + node egress.

---

## 1. The `DisbursementRail` boundary (the #1 de-risk seam)

The single abstraction that isolates "needs a live node" from everything else. One interface,
two implementations, swapped by **one env var** — `MANDATEPAY_RAIL`.

```ts
// packages/shared/src/rail.ts  (full types live there; sketch here)
interface DisbursementInstruction {        // what the agent hands the rail
  cycleId: string;
  recipientRef: string;        // OPAQUE bank_account_ref — never a real account number
  amountCents: number;
  employeeId: string;
  mandateVcId: string;         // the delegation credential this payout is bound to
  nonce: string;               // replay protection (also checked on-chain)
}

interface DispatchReceipt {                 // what the rail returns
  status: "dispatched" | "halted" | "rejected";
  railRef: string;             // rail-side reference (Stripe id / tee tx ref)
  resolvedAccountMasked: string; // e.g. "**** **** **** 4242" — masked, for the UI only
  placeholderUsed: string;     // the literal "{{account}}" token the agent saw
  txHash?: string | null;      // ledger ref when present
  dispatchedAtMs: number;
}

interface DisbursementRail {
  readonly kind: "mock-stripe" | "t3-payroll";
  dispatch(i: DisbursementInstruction): Promise<DispatchReceipt>;
}
```

| Impl | `MANDATEPAY_RAIL` | Status | Notes |
|---|---|---|---|
| `MockStripeRail` | `mock` (default) | ✅ built P1.4 | Performs the `bank_account_ref → {{account}}` substitution **on our side**, with the identical placeholder pattern, against a local fixture vault. Fully offline. The whole demo runs on this today. |
| `T3PayrollRail` | `t3-payroll` | 🟡 stubbed P1.4 | Calls `execute-disbursement` on `tee:payroll` via `T3nClient.executeAndDecode`. Wire-parsing is **thin and TODO-marked** — we do NOT guess the response shape; confirmed against a live node in §3. |

**Swap contract:** when we flip `MANDATEPAY_RAIL=t3-payroll`, *nothing else in the app, agent,
or UI should change.* The rail is the only thing that knows about the node.

---

## 2. Zero-PII, provable on our side (non-negotiable)

"Trust us, it's in the TEE" is not a demo. We make the boundary inspectable in our own code:

1. **Type-level:** the agent's `EmployeePayoutContext` (in `packages/shared`) has **no field**
   for a real account number — only `recipientRef: string` (the opaque `bank_account_ref`).
   It is impossible to put an IBAN/PAN on the agent context without a type error.
2. **Runtime guard:** `assertNoRawAccount(ctx)` runs in the payout path and **throws loudly**
   if any string on the agent context matches IBAN/PAN/routing-number shapes. Tested with
   adversarial inputs.
3. **UI honesty:** the split-screen reads the **real objects** — left pane = the actual agent
   `EmployeePayoutContext` (renders `{{account}}` / the ref), right pane = the actual
   `DispatchReceipt` from the rail (masked resolved account). No hardcoded contrast.

The real account numbers live **only** in the rail's fixture vault (Mock) or **only** inside
the TEE (T3) — never crossing into agent/shared/UI types.

---

## 3. ⛔️ Needs the human + a live node (do NOT guess — confirm on arrival)

Tight checklist for when you're at the computer with the API key and node egress:

1. **Node egress + key.** Allow-list the testnet node host for outbound; set `.env` from
   `.env.example` (`T3N_NODE_URL`, `T3N_API_KEY` / demo EOA key, `ANTHROPIC_API_KEY`).
2. **Tenant bootstrap.** Run the setup script to self-admit a testnet tenant + mint credits
   (`runOtpThenUserInput({ becomeDevTenant: true })`) — see `FEEDBACK_T3.md` #5.
3. **Confirm `tee:payroll` wire shapes (R1).** Exercise `compute-payroll` and
   `execute-disbursement`; replace the TODO-marked parsing in `T3PayrollRail` with the real
   response shape. **This is the #1 risk.** Confirm whether the Stripe test-merchant rail is
   actually wired on testnet, or whether we drive Stripe test mode through the agent.
4. **`bank_account_ref` provisioning.** Confirm how the ref→real-account binding is created
   inside the TEE (how does the test bank know what `ref_alice` maps to?). See `FEEDBACK_T3.md` #4.
5. **Real delegation round-trip.** Sign a credential, push the roster + grant via
   `OrgDataClient`/`SessionOrgDataClient`, run a delegated `buildPayrollInvocation`, and read
   the result via `getAuditEvents`.
6. **Attestation badge → real data.** Wire `verifyTdxQuote`/`fetchDkgAttestation` against the
   node's `/status` so the badge reflects a real enclave measurement (R2 reframe).
7. **Contract deploy.** Deploy `MandatePolicy.sol` to a testnet; put the address in `.env`;
   point `T3PayrollRail`'s pre-dispatch check at it.

Everything above is stubbed/mocked today and gated behind the rail/transport boundary.

---

## 4. Build order (this phase)

- **P1.0** — this doc.
- **P1.1** — pnpm monorepo: `apps/web`, `packages/agent`, `packages/contracts`,
  `packages/shared`; `.env.example`, `.gitignore`, `CLAUDE.md`.
- **P1.2** — `MandatePolicy.sol` + Foundry tests (green). Deploy command prepared, not run.
- **P1.3** — mandate core offline: build → JCS → EIP-191 sign → recover/verify, unit-tested.
- **P1.4** — `DisbursementRail` + `MockStripeRail` + zero-PII type/guard; `T3PayrollRail` stub.
- **P1.5** — agent judgment layer: free-form HR update → deltas + anomaly flags + escalation,
  runs on a mocked LLM now, swaps to Anthropic on key. Strictly advisory.
- **P1.6** — frontend on mock data, click-through end-to-end.

**CI/offline invariant:** `pnpm install && pnpm -r test && pnpm -r build` and `forge test`
must pass with **zero network**. Anything needing the node is behind §1/§3.
