#!/usr/bin/env bash
# Install a published release. Formal upgrades use /opt/z3cz/current/scripts/update.sh vX.Y.Z.
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "==> $*"; }

need_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"
}

docker_cli_ready() {
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

ensure_docker() {
  need_root
  [[ "$(uname -s)" == "Linux" ]] || die "一键安装仅支持 Linux"
  command -v curl >/dev/null 2>&1 || die "需要 curl"
  if docker_cli_ready; then
    log "已检测到 Docker"
    return 0
  fi
  log "未检测到 Docker，开始安装"
  curl -fsSL https://get.docker.com | sh
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker >/dev/null 2>&1 || true
  fi
  if ! docker_cli_ready || ! docker info >/dev/null 2>&1; then
    die "Docker 安装后仍不可用"
  fi
  log "Docker 已安装"
}

install_release() {
  local REPOSITORY VERSION LATEST_URL BASE ASSET TMP CHECKSUM
  REPOSITORY="${Z3CZ_REPOSITORY:-tukeceshi/z3cz}"
  [[ "$REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "仓库名称无效"

  if [[ -n "${Z3CZ_INSTALL_VERSION:-}" ]]; then
    VERSION="$Z3CZ_INSTALL_VERSION"
  else
    LATEST_URL="$(curl -fLsS --retry 3 -o /dev/null -w '%{url_effective}' "https://github.com/$REPOSITORY/releases/latest")"
    VERSION="${LATEST_URL##*/}"
  fi
  [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "正式版本号无效：$VERSION"

  BASE="https://github.com/$REPOSITORY/releases/download/$VERSION"
  ASSET="z3cz-${VERSION}-deploy.tar.gz"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  curl -fL --retry 3 "$BASE/SHA256SUMS" -o "$TMP/SHA256SUMS"
  CHECKSUM="$(awk -v asset="$ASSET" '$2 == asset && length($1) == 64 && $1 ~ /^[a-fA-F0-9]+$/ {print $1}' "$TMP/SHA256SUMS")"
  [[ "$CHECKSUM" =~ ^[a-fA-F0-9]{64}$ ]] || die "找不到部署包的 SHA-256 校验值"
  curl -fL --retry 3 "$BASE/$ASSET" -o "$TMP/$ASSET"
  (cd "$TMP" && printf '%s  %s\n' "$CHECKSUM" "$ASSET" | sha256sum -c -)
  mkdir "$TMP/release"
  tar -xzf "$TMP/$ASSET" -C "$TMP/release"
  [[ "$(tr -d '\r\n' < "$TMP/release/VERSION")" == "$VERSION" ]] || die "部署包版本不匹配"
  bash "$TMP/release/scripts/install.sh"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  ensure_docker
  install_release
fi
