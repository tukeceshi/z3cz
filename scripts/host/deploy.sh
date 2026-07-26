#!/usr/bin/env bash
# Step 3: Build and start stack.
#   sudo /var/dafthunk/scripts/host/deploy.sh
#   sudo /var/dafthunk/scripts/host/deploy.sh --detach
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
APP_YML="${HOST_DIR}/containers/app.yml"
REBUILD_LOG="${INSTALL_DIR}/rebuild.log"
TMUX_SESSION="dafthunk-deploy"
DETACH=0

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach) DETACH=1; shift ;;
    -h|--help)
      echo "Usage: sudo $0 [--detach]"
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)"
[[ -f "$APP_YML" ]] || die "Missing $APP_YML — run configure.sh first"
[[ -x "${HOST_DIR}/launcher" ]] || die "Missing ${HOST_DIR}/launcher"

hostname="$(grep -E '^hostname:' "$APP_YML" | head -1 | sed 's/^hostname:[[:space:]]*//')"

log "Deploy (log: $REBUILD_LOG)"
docker pull "${DAFTHUNK_NODE_IMAGE:-node:22.12.0-bookworm-slim}" >/dev/null 2>&1 || true

cd "$HOST_DIR"
rebuild_cmd="./launcher rebuild 2>&1 | tee -a '${REBUILD_LOG}'"

if [[ "$DETACH" == "1" ]] && command -v tmux >/dev/null 2>&1; then
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  tmux new-session -d -s "$TMUX_SESSION" "$rebuild_cmd"
  info "Rebuild started in tmux '$TMUX_SESSION'"
  info "Attach: tmux attach -t $TMUX_SESSION"
  info "Log: tail -f $REBUILD_LOG"
  exit 0
fi

eval "$rebuild_cmd"

if [[ -n "$hostname" ]] && command -v curl >/dev/null 2>&1; then
  code="$(curl -sI -m 20 "https://${hostname}" 2>/dev/null | awk 'NR==1{print $2}')"
  [[ -n "$code" ]] && info "HTTP https://${hostname} → $code"
fi

info "Open https://${hostname} — first registered user is admin"
