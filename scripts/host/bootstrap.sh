#!/usr/bin/env bash
# Native one-command installer with host services and release archives.
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/opt/z3cz}"
STATE_DIR="${DAFTHUNK_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${DAFTHUNK_CONFIG_DIR:-/etc/z3cz}"
ARCH=""
ARCHIVE_URL="${DAFTHUNK_ARCHIVE:-}"
GITHUB_MIRROR="${DAFTHUNK_GITHUB_MIRROR:-https://ghfast.top/}"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"
[[ "$(uname -s)" == Linux ]] || die "仅支持使用 systemd 的 Linux 服务器"
need_cmd systemctl || die "当前系统没有 systemd"
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) die "不支持的 CPU 架构：$(uname -m)" ;;
esac
ARCHIVE_URL="${ARCHIVE_URL:-https://github.com/tukeceshi/z3cz/releases/download/self-host/z3cz-server-linux-${ARCH}.tar.gz}"

[[ -r /etc/os-release ]] || die "无法识别 Linux 发行版"
# shellcheck disable=SC1091
source /etc/os-release
case "${ID:-}:${VERSION_ID:-}" in
  ubuntu:22.04|ubuntu:24.04|ubuntu:26.04|debian:12) ;;
  *) die "当前仅支持 Ubuntu 22.04/24.04/26.04 和 Debian 12" ;;
esac

install_dependencies() {
  need_cmd apt-get || die "缺少 apt-get"
  log "安装 PostgreSQL、Caddy 和基础工具"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl tar gzip openssl postgresql caddy
}

download() {
  local url="$1" dest="$2" mirror="${GITHUB_MIRROR%/}/$1"
  curl -fL --connect-timeout 20 --retry 3 "$url" -o "$dest" \
    || curl -fL --connect-timeout 20 --retry 3 "$mirror" -o "$dest"
}

install_release() {
  local archive sums base asset expected actual release version
  archive="$(mktemp --suffix=.tar.gz)"
  sums="$(mktemp)"
  trap 'rm -f "${archive:-}" "${sums:-}"' EXIT
  base="${ARCHIVE_URL%/*}"
  asset="${ARCHIVE_URL##*/}"
  log "下载原生部署包 (${ARCH})"
  download "$ARCHIVE_URL" "$archive" || die "部署包下载失败"
  download "${base}/SHA256SUMS" "$sums" || die "校验清单下载失败"
  expected="$(awk -v name="$asset" '$2 == name {print $1; exit}' "$sums")"
  [[ "$expected" =~ ^[a-fA-F0-9]{64}$ ]] || die "校验清单中缺少 $asset"
  actual="$(sha256sum "$archive" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || die "部署包 SHA-256 校验失败"
  version="$(tar -xOf "$archive" ./VERSION 2>/dev/null | tr -d 'v\r\n' || true)"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] || version="self-host-$(date +%Y%m%d%H%M%S)"
  release="${INSTALL_DIR}/releases/${version}"
  mkdir -p "$release" "$STATE_DIR/storage" "$STATE_DIR/backups" "$STATE_DIR/maintenance" "$CONFIG_DIR"
  tar -xzf "$archive" -C "$release"
  chown -R root:root "$release"
  chmod -R a+rX "$release"
  ln -sfn "$release" "${INSTALL_DIR}/current.next"
  mv -Tf "${INSTALL_DIR}/current.next" "${INSTALL_DIR}/current"
  rm -f "$archive" "$sums"
  trap - EXIT
  info "已安装版本：${version}"
}

install_dependencies
id z3cz >/dev/null 2>&1 || useradd --system --home "$STATE_DIR" --shell /usr/sbin/nologin z3cz
install_release
chown -R z3cz:z3cz "$STATE_DIR"
chmod 0750 "$STATE_DIR" "$STATE_DIR/storage" "$STATE_DIR/backups"

log "配置并启动"
export DAFTHUNK_INSTALL_DIR="$INSTALL_DIR" DAFTHUNK_STATE_DIR="$STATE_DIR" DAFTHUNK_CONFIG_DIR="$CONFIG_DIR"
bash "${INSTALL_DIR}/current/scripts/host/configure.sh"
bash "${INSTALL_DIR}/current/scripts/host/deploy.sh"
