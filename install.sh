#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node &>/dev/null; then
  echo "Node.js 22+ is required. Install from https://nodejs.org/"
  exit 1
fi

if ! command -v corepack &>/dev/null; then
  echo "corepack is required (bundled with Node.js)."
  exit 1
fi

corepack enable
if ! command -v pnpm &>/dev/null; then
  corepack prepare pnpm@latest --activate
fi

echo "[HyperClaw] Installing dependencies..."
pnpm install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "[HyperClaw] Created .env from .env.example — please set OAUTH_ENCRYPTION_SECRET etc."
fi

echo "[HyperClaw] Done. Run: pnpm dev:local"
