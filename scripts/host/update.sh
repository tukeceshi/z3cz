#!/usr/bin/env bash
# Pull latest code and redeploy (run as root — repo is root-owned after bootstrap).
#   sudo bash /var/dafthunk/scripts/host/update.sh
#   sudo bash /var/dafthunk/scripts/host/update.sh --detach
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -d "${INSTALL_DIR}/.git" ]] || die "Not a git repo: ${INSTALL_DIR}"

log "git pull"
git -C "$INSTALL_DIR" pull

log "deploy"
exec bash "${INSTALL_DIR}/scripts/host/deploy.sh" "$@"
