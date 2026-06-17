# How MandatePay differs from Terminal 3's stock payroll example

The T3N SDK ships a **purpose-built payroll delegation system** (`buildPayrollInvocation`,
`PAYROLL_FUNCTIONS_V1`, `EmployeeRecord`, …). That means the payroll *plumbing* is Terminal 3's
canonical example — other teams will build something that looks identical, and judges reward
originality (reused/obvious submissions score poorly). **Our payroll core is deliberately
idiomatic; our differentiation is three things the stock example does not emphasize.** This
doc is the source we lift into the final README + video script.

## 1. The agent judgment layer (the real "agent")
The canonical example treats payroll as structured input. We give the LLM **genuine judgment
work the deterministic layer cannot do**:
- **Interpretation** — ingest messy free-form HR updates ("Ivanov left, Petrov on 0.5 rate
  from the 15th, sales gets a 10% bonus") and compute correct per-employee payout deltas,
  shown as a reviewable diff against the roster.
- **Anomaly reasoning** — when a line deviates beyond a deterministic threshold (e.g. +300%
  vs. baseline) or an account changed, the agent **halts that line** and escalates.
- **Explanation** — a plain-language justification for every decision, written into the ledger.

The hard split: **the LLM proposes, the signed mandate + contract authorize.** If the decision
fits in an `if/else`, it stays in the deterministic layer — the LLM never moves money.

## 2. On-chain defense-in-depth mirror
`MandatePolicy.sol` independently re-enforces allowlist + ceiling + per-line cap +
nonce/replay on-chain, **in addition to** the TEE-signed credential. Two independent
enforcement layers from two different trust roots (TEE attestation + public chain).
Explicitly **non-load-bearing**: if the chain is down, the TEE bounds still hold — but when
it's up, a payout must satisfy *both*. The stock example has one enforcement path; we have two.

## 3. Trust-visualization UX (trust you can *see*)
Terminal 3's whole thesis is "trust you can see," so we visualize the trust flow in real time:
- **Split-screen** — left: exactly what the agent held (`{{account}}` placeholder / opaque
  ref), right: what the rail dispatched (masked resolved account). **Backed by real objects**,
  not hardcoded — the left pane renders the agent's actual `EmployeePayoutContext`, which by
  construction has no field for a real account number.
- **Live attested ledger** — host-stamped immutable audit batches with `tx_hash` + a **TDX
  attestation badge** (real enclave measurement when on a live node). Positioned honestly: no
  invented client-side Merkle-proof object — integrity = attestation + immutable batches.

## One-liner for the README/video
> *MandatePay isn't "an agent that does payroll." It's a CFO handing an autonomous agent a
> signed, bounded mandate it can read but cannot exceed — where you can watch, line by line,
> the agent reason over messy human instructions, never touch a real account number, get
> stopped cold by anomalies, and write every move to an attested ledger.*
