#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ENV="${1:-}"

if [ -z "$SOURCE_ENV" ]; then
  for candidate in "$ROOT_DIR/.env.local" "$ROOT_DIR/.env" "$ROOT_DIR/.env.example"; do
    if [ -f "$candidate" ]; then
      SOURCE_ENV="$candidate"
      break
    fi
  done
fi

if [ -z "$SOURCE_ENV" ] || [ ! -f "$SOURCE_ENV" ]; then
  echo "No environment file found. Expected .env.local, .env, or .env.example in the repo root." >&2
  exit 1
fi

FRONTEND_ENV="$ROOT_DIR/frontend/.env.local"
ASP_ENV="$ROOT_DIR/asp/.env"

awk '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
  /^VITE_/ { print }
' "$SOURCE_ENV" > "$FRONTEND_ENV"

awk '
  function trim(value) {
    sub(/^[[:space:]]+/, "", value)
    sub(/[[:space:]]+$/, "", value)
    return value
  }

  /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
  {
    split($0, parts, "=")
    key = trim(parts[1])
    value = substr($0, index($0, "=") + 1)

    if (key == "WORKER_PATH" && value == "./asp/worker/worker.mjs") {
      value = "./worker/worker.mjs"
    } else if (key == "DEPLOYED_ADDRESSES_PATH" && value == "./contracts/solidity/deployments/contracts.json") {
      value = "../contracts/solidity/deployments/contracts.json"
    }

    if (key !~ /^VITE_/) {
      print key "=" value
    }
  }
' "$SOURCE_ENV" > "$ASP_ENV"

echo "Generated:"
echo "  - $FRONTEND_ENV"
echo "  - $ASP_ENV"
