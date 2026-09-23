#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
PREVIOUS="$(readlink -f "$INSTALL_DIR/previous")"; [[ -d "$PREVIOUS" ]] || die "没有可回退版本"
CURRENT="$(readlink -f "$INSTALL_DIR/current")"; switch_link previous "$CURRENT"; switch_link current "$PREVIOUS"
compose "$PREVIOUS" up -d --force-recreate --wait; rm -f "$STATE_DIR/maintenance/enabled"; log "应用已回退到 $(cat "$PREVIOUS/VERSION")"
