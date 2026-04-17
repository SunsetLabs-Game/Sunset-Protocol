#!/usr/bin/env bash
# Sunset Solidity Verifier Generation Script
# Exports Groth16 Solidity verifier contracts from verification keys using snarkjs
# These contracts are deployed on Conflux eSpace (EVM-compatible)

set -euo pipefail

CIRCUITS_DIR="$(dirname "$0")/.."
BUILD_DIR="$CIRCUITS_DIR/build"
OUT_DIR="$CIRCUITS_DIR/build/solidity_verifiers"

echo "==================================================="
echo "  Sunset Solidity Verifier Generation"
echo "==================================================="
echo ""

# Check if snarkjs is available
if ! command -v snarkjs &> /dev/null; then
  echo "ERROR: snarkjs not found."
  echo ""
  echo "Install snarkjs with:"
  echo "  bun install   (from the circuits/ directory)"
  echo "  # or globally: npm install -g snarkjs"
  echo ""
  exit 1
fi

mkdir -p "$OUT_DIR"

# Array of circuits to process
CIRCUITS=("membership" "swap" "mint" "burn")

for i in "${!CIRCUITS[@]}"; do
  circuit="${CIRCUITS[$i]}"
  idx=$((i + 1))

  echo "[$idx/4] Generating Solidity verifier for $circuit..."

  ZKEY_FILE="$BUILD_DIR/$circuit/${circuit}_0000.zkey"
  SOL_FILE="$OUT_DIR/${circuit}_verifier.sol"

  # Check if zkey exists
  if [ ! -f "$ZKEY_FILE" ]; then
    echo "      ERROR: zkey not found: $ZKEY_FILE"
    echo "      Run setup.sh first."
    exit 1
  fi

  snarkjs zkey export solidityverifier \
    "$ZKEY_FILE" \
    "$SOL_FILE"

  echo "      Done. Output: $SOL_FILE"
  echo ""
done

echo "==================================================="
echo "  Solidity verifier generation complete!"
echo "==================================================="
echo ""
echo "Generated verifier contracts (EVM / Conflux eSpace compatible):"
for circuit in "${CIRCUITS[@]}"; do
  echo "  - $OUT_DIR/${circuit}_verifier.sol"
done
echo ""
echo "Next steps:"
echo "  1. Deploy each verifier contract to Conflux eSpace"
echo "  2. Pass verifier addresses to SunsetVerifierCoordinator constructor"
echo "  3. Call setVerifier() for each CircuitKind (Membership, Swap, Mint, Burn)"
echo ""
