#!/usr/bin/env bash
# Stop the stack before the engine disappears so Postgres can finish its 60s checkpoint.
set -euo pipefail
INSTALL_DIR="${Z3CZ_INSTALL_DIR:-/opt/z3cz}"
release="$(readlink -f "$INSTALL_DIR/current" 2>/dev/null || true)"
[[ -n "$release" && -f "$release/scripts/common.sh" && -f "$release/compose.yml" ]] || exit 0
# shellcheck disable=SC1091
source "$release/scripts/common.sh"
if ! docker info >/dev/null 2>&1; then
  exit 0
fi
log "关机前停止服务"
compose "$release" stop --timeout 70
