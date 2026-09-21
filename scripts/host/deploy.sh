#!/usr/bin/env bash
# Step 4: Start stack from packaged images.
#   sudo /var/dafthunk/scripts/host/deploy.sh
#   sudo /var/dafthunk/scripts/host/deploy.sh --detach
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
APP_YML="${HOST_DIR}/containers/app.yml"
REBUILD_LOG="${INSTALL_DIR}/rebuild.log"
TMUX_SESSION="dafthunk-deploy"
DETACH=0

log() { printf '==> %s\n' "$*" >&2; }
info() { printf ' -> %s\n' "$*" >&2; }
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

if [[ "$DETACH" == "1" && -f "${INSTALL_DIR}/SOURCE_REVISION" ]]; then
  systemd-run --unit=z3cz-source-install --collect \
    --setenv="DAFTHUNK_INSTALL_DIR=${INSTALL_DIR}" \
    /bin/bash "${INSTALL_DIR}/scripts/host/deploy.sh"
  info "后台部署已启动：journalctl -fu z3cz-source-install"
  exit 0
fi

if [[ -f "${INSTALL_DIR}/SOURCE_REVISION" ]]; then
  if ! command -v git >/dev/null 2>&1; then
    command -v apt-get >/dev/null 2>&1 || die "请先安装 git"
    apt-get update -qq
    apt-get install -y -qq git
  fi
fi

if [[ -f "${INSTALL_DIR}/scripts/host/install-host-updater.sh" ]]; then
  log "Ensure host updater"
  bash "${INSTALL_DIR}/scripts/host/install-host-updater.sh"
fi

hostname="$(grep -E '^hostname:' "$APP_YML" | head -1 | sed 's/^hostname:[[:space:]]*//')"

log "Deploy (log: $REBUILD_LOG)"

cd "$HOST_DIR"
rebuild_cmd="./launcher rebuild 2>&1 | tee -a '${REBUILD_LOG}'"
if [[ -f "${INSTALL_DIR}/SOURCE_REVISION" ]]; then
  source "${INSTALL_DIR}/scripts/host/postgres-data-dir.sh"
  prepare_postgres_data_dir "${HOST_DIR}/shared/postgres"
  mkdir -p "${HOST_DIR}/shared/storage" "${HOST_DIR}/shared/maintenance" "${HOST_DIR}/shared/caddy-config"
  # The service owns background updates. Stop it during the one-time CLI migration.
  systemctl stop z3cz-updater.service
  trap 'systemctl start z3cz-updater.service' EXIT
  export Z3CZ_INSTALL_DIR="$INSTALL_DIR"
  /usr/local/bin/z3cz-host-updater install-source 2>&1 | tee -a "$REBUILD_LOG"
  exit 0
fi

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
  if [[ -n "$code" ]]; then
    info "HTTPS https://${hostname} → $code"
  else
    info "HTTPS not ready for https://${hostname} — check: sudo docker logs dafthunk-host-caddy-1 2>&1 | tail -30"
    info "Re-run: sudo bash ${INSTALL_DIR}/scripts/host/https-setup.sh"
    info "Or ZeroSSL only: sudo bash ${INSTALL_DIR}/scripts/host/https-fallback.sh"
    info "Manual: upload to ${HOST_DIR}/shared/caddy/certs/${hostname}/, tls: manual, then https-reload.sh"
  fi
fi

info "Open https://${hostname} — first registered user is admin"
