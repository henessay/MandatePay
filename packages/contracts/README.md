# MandatePay — `contracts`

`MandatePolicy.sol` is the on-chain **defense-in-depth mirror** of a CFO-signed
payroll mandate.

## Role: NOT load-bearing

MandatePay delegates payroll payouts to an AI agent acting under a CFO-signed
mandate. The **primary, load-bearing** enforcement is a **TEE-signed delegation
credential** built off-chain. `MandatePolicy` is a **secondary, independent**
re-enforcement of the same bounds: a payout that somehow bypassed the signed
bounds still cannot execute on-chain.

If the chain is unavailable the TEE bounds still hold — this contract exists so
the bounds are checked a second time, by a second independent system, before
value moves.

## Bounds it re-enforces

The agent's payout path calls `authorizeDisbursement(...)` before dispatching
funds. It reverts (with a specific custom error) unless **all** hold:

- **Active** — the mandate is created and not revoked (`MandateInactive`).
- **Time window** — `notBefore <= block.timestamp <= notAfter` (`OutsideWindow`).
- **Allowlist** — the recipient has a non-zero line cap (`NotAllowlisted`).
- **Per-line cap** — single disbursement `<= lineCapCents` (`LineCapExceeded`).
- **Total ceiling** — `spentCents + amount <= ceilingCents` (`CeilingExceeded`).
- **Replay** — the `nonce` has not been used for this mandate (`NonceReused`).

On success it consumes the nonce, increments `spentCents`, and emits
`DisbursementAuthorized`. Mandate lifecycle (`createMandate`, `revokeMandate`)
is `onlyOwner`, where `owner` is the CFO / mandate authority set at deploy.

## Build & test

Zero external dependencies — no `forge-std`, no git submodules. Tests use a
minimal local `Vm` cheatcode interface and a tiny `Asserts` harness.

```sh
forge build
forge test -vvv
```

15 tests, all green.

## Deploy (for a human to run later — do NOT auto-deploy)

The constructor takes a single argument: the **CFO / owner address**.

```sh
forge create src/MandatePolicy.sol:MandatePolicy \
  --rpc-url $RPC_URL \
  --private-key $PK \
  --constructor-args <cfo_address>
```
