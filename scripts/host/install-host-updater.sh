#!/usr/bin/env bash
# Install the host updater systemd service.
#   sudo bash /var/dafthunk/scripts/host/install-host-updater.sh
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
SOCKET_DIR="${Z3CZ_UPDATER_SOCKET_DIR:-/run/z3cz-updater}"
STATE_DIR="${Z3CZ_UPDATER_STATE_DIR:-/var/lib/z3cz-updater}"
UPDATER_BIN="/usr/local/bin/z3cz-host-updater"
UPDATER_ENV="/etc/z3cz-updater.env"
UPDATER_SERVICE="/etc/systemd/system/z3cz-updater.service"
REPOSITORY="${Z3CZ_UPDATER_REPOSITORY:-tukeceshi/z3cz}"
GITHUB_MIRROR="${DAFTHUNK_GITHUB_MIRROR:-https://ghfast.top/}"
GITHUB_MIRROR="${GITHUB_MIRROR%/}/"
RELEASE_TAG=""

fail() { printf 'Host Updater 安装失败：%s\n' "$1" >&2; exit 1; }

updater_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'amd64' ;;
    aarch64|arm64) printf 'arm64' ;;
    *) fail "不支持的 CPU 架构：$(uname -m)" ;;
  esac
}

mirror_url() {
  case "$1" in
    "${GITHUB_MIRROR}"*) printf '%s' "$1" ;;
    *) printf '%s%s' "$GITHUB_MIRROR" "$1" ;;
  esac
}

download_file() {
  local url="$1" dest="$2"
  local alt
  alt="$(mirror_url "$url")"
  if curl -fsSL --connect-timeout 20 "$url" -o "$dest"; then
    return 0
  fi
  [[ "$alt" != "$url" ]] || return 1
  curl -fsSL --connect-timeout 20 "$alt" -o "$dest"
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "请使用 sudo 运行"
  [[ "$(uname -s)" == "Linux" ]] || fail "仅支持 Linux 服务器"
  command -v systemctl >/dev/null 2>&1 || fail "服务器必须使用 systemd"
  command -v docker >/dev/null 2>&1 || fail "缺少 docker"
  command -v curl >/dev/null 2>&1 || fail "缺少 curl"
  command -v sha256sum >/dev/null 2>&1 || fail "缺少 sha256sum"
  [[ -f "${INSTALL_DIR}/docker-host/containers/app.yml" ]] || fail "未找到 ${INSTALL_DIR}/docker-host/containers/app.yml"
}

read_image_tag() {
  local tag
  tag="$(awk 'BEGIN{FS=":[[:space:]]*"} /^image_tag:/ { print $2; exit }' "${INSTALL_DIR}/docker-host/containers/app.yml" | tr -d '[:space:]')"
  if [[ "$tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    if [[ "$tag" == v* ]]; then
      RELEASE_TAG="$tag"
    else
      RELEASE_TAG="v${tag}"
    fi
    return 0
  fi
  printf '提示：当前 image_tag 不是正式版本。安装完成后可在后台升到 GitHub 正式版。\n'
}

verify_checksum() {
  local file="$1" sums="$2" asset="$3"
  local expected
  expected="$(awk -v asset="$asset" '$2 == asset { print $1; exit }' "$sums")"
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || fail "校验清单缺少 ${asset}"
  printf '%s  %s\n' "$expected" "$file" | sha256sum -c - >/dev/null || fail "Host Updater SHA-256 校验失败"
}

install_binary() {
  local arch asset local_bin local_sums tmp sums
  arch="$(updater_arch)"
  asset="z3cz-host-updater-linux-${arch}"
  local_bin="${INSTALL_DIR}/dist/${asset}"
  local_sums="${INSTALL_DIR}/dist/SHA256SUMS"
  tmp="$(mktemp)"
  sums="$(mktemp)"
  trap 'rm -f "${tmp:-}" "${sums:-}"; trap - RETURN' RETURN

  if [[ -f "$local_bin" && -f "$local_sums" ]]; then
    verify_checksum "$local_bin" "$local_sums" "$asset"
    install -m 0755 "$local_bin" "$UPDATER_BIN"
    return 0
  fi

  if [[ -n "$RELEASE_TAG" ]]; then
    if download_file "https://github.com/${REPOSITORY}/releases/download/${RELEASE_TAG}/SHA256SUMS" "$sums" \
      && download_file "https://github.com/${REPOSITORY}/releases/download/${RELEASE_TAG}/${asset}" "$tmp"; then
      verify_checksum "$tmp" "$sums" "$asset"
      install -m 0755 "$tmp" "$UPDATER_BIN"
      return 0
    fi
    printf '提示：未能从 GitHub Release 下载更新器，改用部署包内二进制。\n'
  fi

  [[ -f "$local_bin" ]] || fail "未找到更新器二进制 ${local_bin}，请使用包含 dist/ 的部署包"
  cp "$local_bin" "$tmp"
  if [[ -f "$local_sums" ]]; then
    verify_checksum "$tmp" "$local_sums" "$asset"
  fi
  install -m 0755 "$tmp" "$UPDATER_BIN"
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
  printf 'Z3CZ_UPDATER_TOKEN=%s\nZ3CZ_INSTALL_DIR=%s\nZ3CZ_UPDATER_SOCKET=%s/updater.sock\nZ3CZ_UPDATER_STATE_DIR=%s\nZ3CZ_UPDATER_BINARY_PATH=%s\n' \
    "$token" "$INSTALL_DIR" "$SOCKET_DIR" "$STATE_DIR" "$UPDATER_BIN" > "$UPDATER_ENV"
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
ExecStart=${UPDATER_BIN} serve
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=${INSTALL_DIR} ${STATE_DIR} ${SOCKET_DIR} /usr/local/bin /run /var/run

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
  install_binary
  ensure_token
  install_service
  printf 'Host Updater 已安装，Socket：%s/updater.sock\n' "$SOCKET_DIR"
}

main "$@"
