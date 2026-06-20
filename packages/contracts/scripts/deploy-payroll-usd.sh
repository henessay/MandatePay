#!/usr/bin/env bash
#
# Deploy the PayrollUSD (mUSD) test token to Sepolia. The deployer becomes the
# owner AND receives the full 100,000,000 mUSD initial supply — i.e. the deployer
# wallet is the payroll treasury the agent pays salaries from.
#
# Prereqs: foundry (`forge`), Sepolia ETH on the deployer key for gas.
# Run from the repo (any dir):
#   DEPLOYER_PRIVATE_KEY=0x... bash packages/contracts/scripts/deploy-payroll-usd.sh
#
# Copy the printed "Deployed to: 0x..." into apps/web/.env.local as
#   EVM_TOKEN_ADDRESS=0x...
set -euo pipefail

RPC=${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}
PK=${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY=0x... (the treasury/deployer key, e.g. 0xD69D...)}

cd "$(dirname "$0")/.."

echo "== Deploying PayrollUSD to Sepolia (mints 100,000,000 mUSD to the deployer/treasury) =="
forge create src/PayrollUSD.sol:PayrollUSD \
  --rpc-url "$RPC" --private-key "$PK" --broadcast

echo
echo "Done. Set EVM_TOKEN_ADDRESS to the 'Deployed to' address above."
echo "Treasury balance can be checked with:"
echo "  cast call <TOKEN> 'balanceOf(address)(uint256)' <TREASURY> --rpc-url $RPC"
