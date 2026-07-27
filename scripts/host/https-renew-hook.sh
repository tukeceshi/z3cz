#!/usr/bin/env bash
# acme.sh reloadcmd: on fallback renewal, try Caddy auto first.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if bash "${SCRIPT_DIR}/https-try-auto.sh"; then
  exit 0
fi

bash "${SCRIPT_DIR}/https-reload.sh"
