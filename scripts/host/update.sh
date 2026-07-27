#!/usr/bin/env bash
# Pull latest code, migrate DB (journal order), then redeploy.
#   sudo bash /var/dafthunk/scripts/host/update.sh
#   sudo bash /var/dafthunk/scripts/host/update.sh --detach
#   sudo bash /var/dafthunk/scripts/host/update.sh --skip-migrate
#   sudo bash /var/dafthunk/scripts/host/update.sh --migrate-only
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
DETACH=0
SKIP_MIGRATE=0
MIGRATE_ONLY=0
DEPLOY_ARGS=()

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach)
      DETACH=1
      DEPLOY_ARGS+=(--detach)
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE=1
      shift
      ;;
    --migrate-only)
      MIGRATE_ONLY=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: sudo bash update.sh [--detach] [--skip-migrate|--migrate-only]

  (default)       git pull → precheck + migrate → rebuild
  --detach        rebuild in tmux (passed to deploy.sh)
  --skip-migrate  git pull → rebuild only (no DB migrate)
  --migrate-only  git pull → precheck + migrate, no rebuild
EOF
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

if [[ "$SKIP_MIGRATE" -eq 1 && "$MIGRATE_ONLY" -eq 1 ]]; then
  die "Use only one of --skip-migrate or --migrate-only"
fi

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -d "${INSTALL_DIR}/.git" ]] || die "Not a git repo: ${INSTALL_DIR}"

log "git pull"
git -C "$INSTALL_DIR" pull

if [[ "$SKIP_MIGRATE" -eq 0 ]]; then
  log "database migrate"
  bash "${INSTALL_DIR}/scripts/host/db-migrate.sh"
else
  info "Skipping migrate (--skip-migrate)"
fi

if [[ "$MIGRATE_ONLY" -eq 1 ]]; then
  info "Done (--migrate-only; no rebuild)"
  exit 0
fi

log "deploy"
exec bash "${INSTALL_DIR}/scripts/host/deploy.sh" "${DEPLOY_ARGS[@]+"${DEPLOY_ARGS[@]}"}"
