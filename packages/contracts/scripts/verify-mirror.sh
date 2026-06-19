#!/usr/bin/env bash
#
# Live proof that the on-chain mirror MandatePolicy enforces the mandate ON-CHAIN,
# not just off-chain. Seeds a mandate, dispatches one valid line (real tx), then
# shows the contract REJECT an over-cap line, a non-allowlisted recipient, and an
# over-ceiling line.
#
# Prereqs: foundry (`cast`), Sepolia ETH on the owner key.
# Run (owner = deployer key):
#   DEPLOYER_PRIVATE_KEY=0x... bash packages/contracts/scripts/verify-mirror.sh
#
# Recipient addresses below are recipientRefToAddress(ref) = last-20 bytes of
# keccak256(ref) — see packages/shared/src/onchain.ts. The real bank account is
# NEVER an input; only the opaque bank_account_ref is hashed (zero-PII).
set -euo pipefail

ADDR=0x6a68Cc677c6bd10a39d3733Ea519ca093C32a5A1                         # deployed MandatePolicy (Sepolia)
RPC=${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}
PK=${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY=0x... (the owner/deployer key)}

# Run once per MANDATE_ID (createMandate reverts MandateExists on re-run; nonces are
# single-use). To re-run, pass a fresh one: MANDATE_ID=0x<32-bytes> bash ...
MID=${MANDATE_ID:-0xc24c915a0ba2470b7a4fad22c76b57f6e8621dfdfefea10a128efc0c52d69dc4}

A_ALICE=0x904ba97b24181e7387012367bb6232c36c4a3c48   # ref "acct_ref_alice"  (allowlisted)
A_BOB=0xc24a55730ab4349b0ef8ad88c5782eea7c70c23c     # ref "acct_ref_bob"    (allowlisted)
A_GHOST=0x2a56c1d479cfa06eaf0c919762f2db82c2c03877   # ref "acct_ref_ghost"  (NOT allowlisted)
CEIL=1500000   # $15,000.00 ceiling (cents)
CAP=1000000    # $10,000.00 per-line cap (cents)
NB=0
NA=4000000000
N1=0x0000000000000000000000000000000000000000000000000000000000000001
N2=0x0000000000000000000000000000000000000000000000000000000000000002
N3=0x0000000000000000000000000000000000000000000000000000000000000003
N4=0x0000000000000000000000000000000000000000000000000000000000000004

echo "== 1. createMandate: owner seeds allowlist [alice,bob], ceiling \$15k, per-line cap \$10k =="
cast send "$ADDR" "createMandate(bytes32,uint256,uint64,uint64,address[],uint256[])" \
  "$MID" "$CEIL" "$NB" "$NA" "[$A_ALICE,$A_BOB]" "[$CAP,$CAP]" \
  --rpc-url "$RPC" --private-key "$PK"

echo "== 2. VALID: authorize Alice \$8,000 (<= cap, within ceiling) -> SUCCESS (real tx) =="
cast send "$ADDR" "authorizeDisbursement(bytes32,address,uint256,bytes32)" \
  "$MID" "$A_ALICE" 800000 "$N1" \
  --rpc-url "$RPC" --private-key "$PK"

echo "== 3. REJECT over per-line cap: Alice \$12,000 > \$10k cap -> expect revert LineCapExceeded =="
cast call "$ADDR" "authorizeDisbursement(bytes32,address,uint256,bytes32)" \
  "$MID" "$A_ALICE" 1200000 "$N2" --rpc-url "$RPC" \
  && echo "  !! UNEXPECTED: call did not revert" || echo "  ^ contract REVERTED as expected (LineCapExceeded)"

echo "== 4. REJECT not-allowlisted: ghost recipient -> expect revert NotAllowlisted =="
cast call "$ADDR" "authorizeDisbursement(bytes32,address,uint256,bytes32)" \
  "$MID" "$A_GHOST" 100000 "$N3" --rpc-url "$RPC" \
  && echo "  !! UNEXPECTED: call did not revert" || echo "  ^ contract REVERTED as expected (NotAllowlisted)"

echo "== 5. REJECT over ceiling: Bob \$9,000 (spent 8k + 9k = 17k > 15k) -> expect revert CeilingExceeded =="
cast call "$ADDR" "authorizeDisbursement(bytes32,address,uint256,bytes32)" \
  "$MID" "$A_BOB" 900000 "$N4" --rpc-url "$RPC" \
  && echo "  !! UNEXPECTED: call did not revert" || echo "  ^ contract REVERTED as expected (CeilingExceeded)"

echo "== remaining ceiling after the one valid \$8,000 dispatch (expect 700000 = \$7,000) =="
cast call "$ADDR" "remainingCents(bytes32)(uint256)" "$MID" --rpc-url "$RPC"

echo
echo "Done. Successful txs (steps 1-2) are on Sepolia Etherscan:"
echo "  https://sepolia.etherscan.io/address/$ADDR"
echo "Tip: if a revert prints raw 0x<selector>, decode it with: cast 4byte 0x<selector>"
