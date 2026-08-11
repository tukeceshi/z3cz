#!/usr/bin/env bash
# Pull latest code, migrate DB (journal order), then redeploy.
#   sudo bash /var/dafthunk/scripts/host/update.sh
#   sudo bash /var/dafthunk/scripts/host/update.sh --detach
#   sudo bash /var/dafthunk/scripts/host/update.sh --skip-migrate
#   sudo bash /var/dafthunk/scripts/host/update.sh --migrate-only
#   sudo bash /var/dafthunk/scripts/host/update.sh --reset
#   sudo bash /var/dafthunk/scripts/host/update.sh --reset -y
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
# shellcheck source=postgres-data-dir.sh
source "${INSTALL_DIR}/scripts/host/postgres-data-dir.sh"
BRANCH="${DAFTHUNK_BRANCH:-main}"
DETACH=0
SKIP_MIGRATE=0
MIGRATE_ONLY=0
RESET=0
ASSUME_YES=0
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
    --reset)
      RESET=1
      shift
      ;;
    -y|--yes)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: sudo bash update.sh [options]

  (default)       git pull → precheck + migrate → rebuild
  --detach        rebuild in tmux (passed to deploy.sh)
  --skip-migrate  git pull → rebuild only (no DB migrate)
  --migrate-only  git pull → precheck + migrate, no rebuild
  --reset         stop stack, wipe DB + uploads, hard reset code, migrate, rebuild
                  (keeps containers/app.yml and HTTPS certs)
  -y, --yes       skip confirmation (for --reset)
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

if [[ "$RESET" -eq 1 && ( "$SKIP_MIGRATE" -eq 1 || "$MIGRATE_ONLY" -eq 1 ) ]]; then
  die "--reset cannot be combined with --skip-migrate or --migrate-only"
fi

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -d "${INSTALL_DIR}/.git" ]] || die "Not a git repo: ${INSTALL_DIR}"

reset_install() {
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    printf '将删除数据库与上传文件，保留域名配置与证书。输入 yes 继续: ' >&2
    read -r confirm
    [[ "$confirm" == "yes" ]] || die "Aborted"
  fi

  if [[ -x "${HOST_DIR}/launcher" && -f "${HOST_DIR}/containers/app.yml" ]]; then
    log "stop stack"
    (cd "$HOST_DIR" && ./launcher destroy) || true
  else
    info "Skip launcher destroy (missing launcher or app.yml)"
  fi

  log "wipe shared data (postgres, storage)"
  reset_postgres_data_dir "${HOST_DIR}/shared/postgres"
  rm -rf "${HOST_DIR}/shared/storage"/*
  mkdir -p "${HOST_DIR}/shared/storage"

  log "git fetch + reset --hard origin/${BRANCH}"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/${BRANCH}"
}

if [[ "$RESET" -eq 1 ]]; then
  reset_install
else
  log "git pull"
  git -C "$INSTALL_DIR" pull
fi

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
