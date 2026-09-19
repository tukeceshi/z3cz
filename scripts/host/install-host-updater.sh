#!/usr/bin/env bash
# Install the host updater systemd service.
#   sudo bash /var/dafthunk/scripts/host/install-host-updater.sh
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
SOCKET_DIR="${Z3CZ_UPDATER_SOCKET_DIR:-/run/z3cz-updater}"
STATE_DIR="${Z3CZ_UPDATER_STATE_DIR:-/var/lib/z3cz-updater}"
NODE_HOME="/usr/local/lib/z3cz-updater"
NODE_BIN="${NODE_HOME}/bin/node"
UPDATER_ENV="/etc/z3cz-updater.env"
UPDATER_SERVICE="/etc/systemd/system/z3cz-updater.service"
NODE_VERSION="22.12.0"

fail() { printf 'Host Updater 安装失败：%s\n' "$1" >&2; exit 1; }

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "请使用 sudo 运行"
  [[ "$(uname -s)" == "Linux" ]] || fail "仅支持 Linux 服务器"
  command -v systemctl >/dev/null 2>&1 || fail "服务器必须使用 systemd"
  command -v docker >/dev/null 2>&1 || fail "缺少 docker"
  command -v curl >/dev/null 2>&1 || fail "缺少 curl"
  [[ -f "${INSTALL_DIR}/docker-host/containers/app.yml" ]] || fail "未找到 ${INSTALL_DIR}/docker-host/containers/app.yml"
  [[ -f "${INSTALL_DIR}/scripts/host/updater/main.mjs" ]] || fail "未找到更新器脚本，请先更新部署包"
}

read_image_tag() {
  local tag
  tag="$(awk 'BEGIN{FS=":[[:space:]]*"} /^image_tag:/ { print $2; exit }' "${INSTALL_DIR}/docker-host/containers/app.yml" | tr -d '[:space:]')"
  if [[ -z "$tag" || "$tag" == "latest" ]]; then
    printf '提示：当前 image_tag 不是正式版本。安装完成后可在后台升到 GitHub 正式版。\n'
  fi
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
    if [[ "${major:-0}" -ge 22 ]]; then
      NODE_BIN="$(command -v node)"
      return 0
    fi
  fi
  local arch asset url
  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) fail "不支持的 CPU 架构：$(uname -m)" ;;
  esac
  asset="node-v${NODE_VERSION}-linux-${arch}"
  mkdir -p "$NODE_HOME"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${asset}.tar.xz"
  if ! curl -fsSL "$url" | tar -xJ -C "$NODE_HOME" --strip-components=1; then
    url="https://npmmirror.com/mirrors/node/v${NODE_VERSION}/${asset}.tar.xz"
    curl -fsSL "$url" | tar -xJ -C "$NODE_HOME" --strip-components=1 || fail "无法下载 Node ${NODE_VERSION}"
  fi
  [[ -x "$NODE_BIN" ]] || fail "Node 安装后未找到 ${NODE_BIN}"
}

ensure_token() {
  local token yaml tmp
  yaml="${INSTALL_DIR}/docker-host/containers/app.yml"
  token="$(awk 'BEGIN{FS=":[[:space:]]*"} /^[[:space:]]+UPDATER_TOKEN:/ { print $2; exit }' "$yaml" | tr -d '[:space:]')"
  if [[ ${#token} -lt 32 ]]; then
    token="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    tmp="$(mktemp)"
    if grep -q '^[[:space:]]*UPDATER_TOKEN:' "$yaml"; then
      awk -v token="$token" '
        /^[[:space:]]*UPDATER_TOKEN:/ { print "  UPDATER_TOKEN: " token; next }
        { print }
      ' "$yaml" > "$tmp"
    else
      awk -v token="$token" '
        /^env:/ { print; print "  UPDATER_TOKEN: " token; next }
        { print }
      ' "$yaml" > "$tmp"
    fi
    mv "$tmp" "$yaml"
  fi
  umask 077
  printf 'Z3CZ_UPDATER_TOKEN=%s\nZ3CZ_INSTALL_DIR=%s\nZ3CZ_UPDATER_SOCKET=%s/updater.sock\nZ3CZ_UPDATER_STATE_DIR=%s\n' \
    "$token" "$INSTALL_DIR" "$SOCKET_DIR" "$STATE_DIR" > "$UPDATER_ENV"
}

install_service() {
  install -d -m 0755 "$SOCKET_DIR"
  install -d -m 0700 "$STATE_DIR" "${INSTALL_DIR}/docker-host/shared/backups"
  cat > "$UPDATER_SERVICE" <<EOF
[Unit]
Description=z3cz Host Updater
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${UPDATER_ENV}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/scripts/host/updater/main.mjs serve
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=${INSTALL_DIR} ${STATE_DIR} ${SOCKET_DIR} /run /var/run

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now z3cz-updater.service
  systemctl restart z3cz-updater.service
}

main() {
  require_root
  read_image_tag
  ensure_node
  ensure_token
  install_service
  printf 'Host Updater 已安装，Socket：%s/updater.sock\n' "$SOCKET_DIR"
  printf '请重建服务使 Token 生效：sudo bash %s/scripts/host/deploy.sh\n' "$INSTALL_DIR"
}

main "$@"
