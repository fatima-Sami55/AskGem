#!/usr/bin/env bash
# AskPeri Local Startup (Unix) — delegates to npm run dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run dev
