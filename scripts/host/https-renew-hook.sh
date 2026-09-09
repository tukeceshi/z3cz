#!/usr/bin/env bash
# acme.sh reloadcmd: reload Caddy with current tls mode (fallback files).
# No-op until the stack has been generated (first install before deploy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=https-common.sh
source "${SCRIPT_DIR}/https-common.sh"

stack_generated || exit 0

bash "${SCRIPT_DIR}/https-reload.sh"
