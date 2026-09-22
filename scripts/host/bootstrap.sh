#!/usr/bin/env bash
# One-command installer: Docker check + download + optional domain setup + deploy.
#   curl -fsSL .../bootstrap-install | sudo bash
#   或: curl -fsSL ".../bootstrap.sh" -o "/tmp/bootstrap.sh" && sudo bash "/tmp/bootstrap.sh"
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
ARCHIVE_URL="${DAFTHUNK_ARCHIVE:-https://github.com/tukeceshi/z3cz/releases/download/self-host/z3cz-deploy.tar.gz}"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

is_wsl() {
  grep -qiE '(microsoft|wsl)' /proc/sys/kernel/osrelease 2>/dev/null \
    || grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null
}

GITHUB_MIRROR="${DAFTHUNK_GITHUB_MIRROR:-https://ghfast.top/}"
GITHUB_MIRROR="${GITHUB_MIRROR%/}/"
ARCHIVE_TRY=()

github_reachable() {
  command -v curl >/dev/null 2>&1 || return 1
  curl -fsS -o /dev/null --connect-timeout 3 --max-time 8 https://github.com/ >/dev/null 2>&1
}

github_mirror_url() {
  local url="$1"
  case "$url" in
    "${GITHUB_MIRROR}"*) printf '%s' "$url" ;;
    *) printf '%s%s' "$GITHUB_MIRROR" "$url" ;;
  esac
}

prepare_archive_urls() {
  local mirrored
  mirrored="$(github_mirror_url "$ARCHIVE_URL")"
  if github_reachable; then
    ARCHIVE_TRY=("$ARCHIVE_URL")
    if [[ "$mirrored" != "$ARCHIVE_URL" ]]; then
      ARCHIVE_TRY+=("$mirrored")
    fi
  else
    info "github.com unreachable, using mirror"
    ARCHIVE_TRY=("$mirrored")
    if [[ "$mirrored" != "$ARCHIVE_URL" ]]; then
      ARCHIVE_TRY+=("$ARCHIVE_URL")
    fi
  fi
}

mem_mib() {
  awk -v key="$1" '$1 == key ":" { print int($2 / 1024); exit }' /proc/meminfo
}

ensure_swap() {
  if is_wsl; then
    info "WSL detected — memory and swap are managed by Windows"
    return 0
  fi
  local ram swap total need
  local target=5800
  ram="$(mem_mib MemTotal)"
  swap="$(mem_mib SwapTotal)"
  total=$((ram + swap))
  info "Memory ${ram}M + swap ${swap}M"
  if ((total >= target)); then
    return 0
  fi
  if [[ -e /swapfile ]]; then
    if swapon --show 2>/dev/null | grep -q '^/swapfile'; then
      swapoff /swapfile || die "Could not disable /swapfile to resize"
    fi
    rm -f /swapfile
    swap="$(mem_mib SwapTotal)"
  fi
  need=$((target - ram - swap))
  if ((need < 1)); then
    return 0
  fi
  log "Adding ${need}M swap at /swapfile"
  if need_cmd fallocate; then
    fallocate -l "${need}M" /swapfile
  else
    dd if=/dev/zero of=/swapfile bs=1M count="$need" status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >>/etc/fstab
}

ensure_docker() {
  # Docker must be checked before downloading or changing any deployment files.
  if need_cmd docker && docker info >/dev/null 2>&1 \
    && (docker compose version >/dev/null 2>&1 || need_cmd docker-compose); then
    info "Docker and Compose are ready"
    return 0
  fi

  if is_wsl; then
    die "Docker Desktop is unavailable in this WSL distribution. Install and start Docker Desktop on Windows, enable Settings → Resources → WSL Integration for this distro, then re-run this command."
  fi

  need_cmd apt-get || die "Docker is required. Install Docker and Docker Compose, then re-run this command."
  log "Docker is not ready — installing Docker"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq docker.io ca-certificates curl tar gzip git
  systemctl enable --now docker 2>/dev/null || true
  if ! docker compose version >/dev/null 2>&1 && ! need_cmd docker-compose; then
    apt-get install -y -qq docker-compose-v2 2>/dev/null \
      || apt-get install -y -qq docker-compose-plugin 2>/dev/null \
      || apt-get install -y -qq docker-compose 2>/dev/null \
      || true
  fi
  need_cmd docker || die "Docker install failed"
  docker info >/dev/null 2>&1 || die "Docker daemon is not running"
  (docker compose version >/dev/null 2>&1 || need_cmd docker-compose) \
    || die "Docker Compose is unavailable"
}

ensure_host_tools() {
  if need_cmd curl && need_cmd tar && need_cmd gzip && need_cmd git; then
    return 0
  fi
  if is_wsl; then
    die "Missing curl, tar, gzip, or git in WSL. Install them with apt, then re-run this command."
  fi
  if ! need_cmd apt-get; then
    die "Need curl, tar, gzip, and git to continue"
  fi
  log "Installing host tools"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl tar gzip git
}

# Docker Hub is the official image registry (registry-1.docker.io).
# Registry mirrors only affect docker pull; they do not install Node on the host.
ensure_docker_registry_mirrors() {
  if is_wsl; then
    info "WSL detected — Docker registry settings are managed by Docker Desktop"
    return 0
  fi
  need_cmd docker || return 0
  local conf=/etc/docker/daemon.json
  mkdir -p /etc/docker
  if [[ -f "$conf" ]] && grep -q 'registry-mirrors' "$conf"; then
    info "Docker registry-mirrors already set"
    return 0
  fi
  if [[ -f "$conf" ]]; then
    warn "Existing $conf has no registry-mirrors — leave it; image pull will try mirrors by name"
    return 0
  fi
  log "Configuring Docker registry mirrors (Docker Hub fallback)"
  cat >"$conf" <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://mirror.ccs.tencentyun.com"
  ]
}
EOF
  systemctl restart docker 2>/dev/null || true
}

looks_like_install() {
  [[ -d "${INSTALL_DIR}/docker-host" && -d "${INSTALL_DIR}/scripts/host" ]]
}

pull_packaged_images() {
  [[ -f "${INSTALL_DIR}/SOURCE_REVISION" ]] && return 0
  [[ -x "${INSTALL_DIR}/docker-host/launcher" ]] || die "Missing docker-host/launcher"
  log "Pulling api/app images"
  (cd "${INSTALL_DIR}/docker-host" && ./launcher pull-app-images)
}

download_and_extract_pack() {
  local url tmp
  tmp="$(mktemp /tmp/dafthunk-deploy.XXXXXX.tar.gz)"
  prepare_archive_urls
  for url in "${ARCHIVE_TRY[@]}"; do
    info "Trying ${url}"
    if curl -fL --connect-timeout 30 --retry 3 --retry-delay 2 --progress-bar \
      -H "Cache-Control: no-cache" -H "Pragma: no-cache" \
      "$url" -o "$tmp" \
      && tar -tzf "$tmp" >/dev/null 2>&1; then
      mkdir -p "$INSTALL_DIR"
      if tar -xzf "$tmp" -C "$INSTALL_DIR"; then
        rm -f "$tmp"
        chmod +x "${INSTALL_DIR}/scripts/host/"*.sh "${INSTALL_DIR}/docker-host/launcher" 2>/dev/null || true
        pull_packaged_images
        if [[ -f "${INSTALL_DIR}/DEPLOY_REVISION" ]]; then
          info "Pack $(cat "${INSTALL_DIR}/DEPLOY_REVISION")"
        fi
        return 0
      fi
      info "Extract failed: ${url}"
    else
      info "Failed: ${url}"
    fi
  done
  rm -f "$tmp"
  die "deploy pack download failed"
}

ensure_pack() {
  if [[ -e "$INSTALL_DIR" ]] && ! looks_like_install; then
    log "Backing up ${INSTALL_DIR}"
    mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
  fi
  log "Downloading deploy pack to ${INSTALL_DIR}"
  download_and_extract_pack
}

log "Bootstrap"
ensure_docker
ensure_host_tools
ensure_docker_registry_mirrors
ensure_swap
ensure_pack
log "Configure and deploy"
export DAFTHUNK_FROM_INSTALL=1
bash "${INSTALL_DIR}/docker-host/dafthunk-setup" --no-rebuild
bash "${INSTALL_DIR}/scripts/host/deploy.sh"
