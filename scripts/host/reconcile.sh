#!/usr/bin/env bash
# Bring the current release up after the engine and bind-mount sources exist.
# Docker's own restart policy does not retry a container that failed while mounting.
set -euo pipefail

load_common() {
  if [[ -n "${Z3CZ_RECONCILE_COMMON:-}" ]]; then
    # shellcheck disable=SC1090
    source "$Z3CZ_RECONCILE_COMMON"
    return 0
  fi
  local release
  release="$(readlink -f "${Z3CZ_INSTALL_DIR:-/opt/z3cz}/current")"
  # shellcheck disable=SC1091
  source "$release/scripts/common.sh"
}

load_common

mount_sources_ready() {
  [[ -d "$STATE_DIR/postgres" && -d "$INSTALL_DIR/current" && -f "$ENV_FILE" && -s "$CONFIG_DIR/postgres.password" ]]
}

wait_for_mounts() {
  local timeout="${Z3CZ_RECONCILE_WAIT:-180}"
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if docker info >/dev/null 2>&1 && mount_sources_ready; then
      return 0
    fi
    sleep 2
  done
  return 1
}

reconcile_main() {
  if ! wait_for_mounts; then
    die "Docker 或数据目录在 ${Z3CZ_RECONCILE_WAIT:-180} 秒内未就绪"
  fi
  mkdir -p "$STATE_DIR/deployment"
  exec 9>"$STATE_DIR/deployment/lock"
  if ! flock -n 9; then
    log "部署进行中，跳过开机编排"
    exit 0
  fi
  local release
  release="$(readlink -f "$INSTALL_DIR/current")"
  [[ -f "$release/compose.yml" ]] || die "当前版本缺少 compose.yml"
  log "开机编排：$release"
  compose "$release" up -d --wait
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  reconcile_main
fi
