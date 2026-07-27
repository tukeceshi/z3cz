#!/usr/bin/env bash
# Post-deploy fallback: ZeroSSL only (same as https-setup --zerossl-only).
#   sudo bash /var/dafthunk/scripts/host/https-fallback.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/https-setup.sh" --zerossl-only "$@"
