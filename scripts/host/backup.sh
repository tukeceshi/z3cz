#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
CURRENT="$(readlink -f "$INSTALL_DIR/current")"; mkdir -p "$STATE_DIR/backups"; OUT="${1:-$STATE_DIR/backups/z3cz-$(date +%Y%m%d%H%M%S).dump}"
compose "$CURRENT" exec -T postgres pg_dump -U z3cz --format=custom z3cz > "$OUT"
sha256sum "$OUT" > "$OUT.sha256"; chmod 600 "$OUT" "$OUT.sha256"; echo "$OUT"
