#!/usr/bin/env bash
# Update to a GitHub Release version.
#   sudo bash /var/dafthunk/scripts/host/update.sh
#   sudo bash /var/dafthunk/scripts/host/update.sh v1.2.0
#   sudo bash /var/dafthunk/scripts/host/update.sh --reset
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
# shellcheck source=postgres-data-dir.sh
source "${INSTALL_DIR}/scripts/host/postgres-data-dir.sh"
UPDATER="${INSTALL_DIR}/scripts/host/updater/main.mjs"
SOCKET="${Z3CZ_UPDATER_SOCKET:-/run/z3cz-updater/updater.sock}"
TARGET=""
RESET=0
ASSUME_YES=0
DETACH=0

log() { printf '==> %s\n' "$*" >&2; }
info() { printf ' -> %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

find_node() {
  if [[ -x /usr/local/lib/z3cz-updater/bin/node ]]; then
    printf '%s' /usr/local/lib/z3cz-updater/bin/node
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  return 1
}

load_updater_env() {
  if [[ -f /etc/z3cz-updater.env ]]; then
    # shellcheck disable=SC1091
    set -a
    source /etc/z3cz-updater.env
    set +a
  fi
  SOCKET="${Z3CZ_UPDATER_SOCKET:-$SOCKET}"
}

updater_request() {
  local method="$1" path="$2" body="${3:-}"
  local token="${Z3CZ_UPDATER_TOKEN:-}"
  [[ -n "$token" ]] || die "缺少 Z3CZ_UPDATER_TOKEN"
  if [[ -n "$body" ]]; then
    curl -fsS --unix-socket "$SOCKET" \
      -H "Authorization: Bearer ${token}" \
      -H "Content-Type: application/json" \
      -X "$method" "http://localhost${path}" \
      -d "$body"
  else
    curl -fsS --unix-socket "$SOCKET" \
      -H "Authorization: Bearer ${token}" \
      -X "$method" "http://localhost${path}"
  fi
}

run_via_service() {
  load_updater_env
  log "Using host updater"
  updater_request POST /v1/check >/dev/null
  local payload
  if [[ -n "$TARGET" ]]; then
    payload="$(printf '{"targetVersion":"%s"}' "$TARGET")"
  else
    TARGET="$(updater_request GET /v1/status | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' | head -1)"
    [[ -n "$TARGET" ]] || die "未找到可更新版本，请先在后台检查更新"
    payload="$(printf '{"targetVersion":"%s"}' "$TARGET")"
  fi
  updater_request POST /v1/update "$payload"
  echo
  info "已提交更新。查看进度：管理后台 → 系统更新"
}

run_via_cli() {
  local node_bin
  node_bin="$(find_node)" || die "未找到 Node。请先安装更新器：sudo bash ${INSTALL_DIR}/scripts/host/install-host-updater.sh"
  [[ -f "$UPDATER" ]] || die "未找到更新器脚本"
  export Z3CZ_INSTALL_DIR="$INSTALL_DIR"
  load_updater_env
  if [[ -n "$TARGET" ]]; then
    exec "$node_bin" "$UPDATER" update "$TARGET"
  fi
  exec "$node_bin" "$UPDATER" update
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach) DETACH=1; shift ;;
    --reset) RESET=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: sudo bash update.sh [version] [options]

  (default)       更新到 GitHub 上最新正式版
  vX.Y.Z          更新到指定正式版
  --reset         停止服务并清空数据库与上传（保留域名和证书）
  -y, --yes       --reset 时跳过确认
EOF
      exit 0
      ;;
    v*)
      TARGET="$1"
      shift
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -d "$INSTALL_DIR" ]] || die "Install dir missing: ${INSTALL_DIR}"

if [[ "$RESET" -eq 1 ]]; then
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    printf '将删除数据库与上传文件，保留域名配置与证书。输入 yes 继续: ' >&2
    read -r confirm
    [[ "$confirm" == "yes" ]] || die "Aborted"
  fi
  if [[ -x "${HOST_DIR}/launcher" && -f "${HOST_DIR}/containers/app.yml" ]]; then
    log "stop stack"
    (cd "$HOST_DIR" && ./launcher destroy) || true
  fi
  log "wipe shared data (postgres, storage)"
  reset_postgres_data_dir "${HOST_DIR}/shared/postgres"
  rm -rf "${HOST_DIR}/shared/storage"/*
  mkdir -p "${HOST_DIR}/shared/storage"
  log "deploy"
  if [[ "$DETACH" -eq 1 ]]; then
    exec bash "${INSTALL_DIR}/scripts/host/deploy.sh" --detach
  fi
  exec bash "${INSTALL_DIR}/scripts/host/deploy.sh"
fi

if [[ -S "$SOCKET" ]] && systemctl is-active --quiet z3cz-updater.service 2>/dev/null; then
  run_via_service
  exit 0
fi

run_via_cli
