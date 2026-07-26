#!/usr/bin/env bash
# Step 1: Docker/Git + swap + clone repo.
#   curl -fsSL .../bootstrap-install | sudo bash
#   或: curl -fsSL ".../bootstrap.sh" -o "/tmp/bootstrap.sh" && sudo bash "/tmp/bootstrap.sh"
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
REPO="${DAFTHUNK_REPO:-https://github.com/tukeceshi/dafthunk.git}"
BRANCH="${DAFTHUNK_BRANCH:-main}"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

mem_mib() {
  awk -v key="$1" '$1 == key ":" { print int($2 / 1024); exit }' /proc/meminfo
}

ensure_swap() {
  local ram swap total
  ram="$(mem_mib MemTotal)"
  swap="$(mem_mib SwapTotal)"
  total=$((ram + swap))
  info "Memory ${ram}M + swap ${swap}M"
  if ((total >= 3800)) || swapon --show 2>/dev/null | grep -q .; then
    return 0
  fi
  log "Adding 2G swap at /swapfile"
  if need_cmd fallocate; then
    fallocate -l 2G /swapfile
  else
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >>/etc/fstab
}

ensure_packages() {
  if need_cmd docker && need_cmd git; then
    info "Docker and Git already installed"
    return 0
  fi
  need_cmd apt-get || die "Need apt-get to install Docker/Git"
  log "Installing Docker and Git"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq docker.io git ca-certificates curl
  systemctl enable --now docker 2>/dev/null || true
  if ! docker compose version >/dev/null 2>&1 && ! need_cmd docker-compose; then
    apt-get install -y -qq docker-compose-v2 2>/dev/null \
      || apt-get install -y -qq docker-compose-plugin 2>/dev/null \
      || apt-get install -y -qq docker-compose 2>/dev/null \
      || true
  fi
  need_cmd docker || die "Docker install failed"
  need_cmd git || die "Git install failed"
}

ensure_repo() {
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log "Updating ${INSTALL_DIR}"
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$INSTALL_DIR" reset --hard "origin/${BRANCH}"
    return 0
  fi
  if [[ -e "$INSTALL_DIR" ]]; then
    mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
  fi
  log "Cloning ${REPO}"
  git clone --branch "$BRANCH" --depth 1 "$REPO" "$INSTALL_DIR"
}

log "Bootstrap"
ensure_packages
ensure_swap
ensure_repo
info "Done. Next: sudo ${INSTALL_DIR}/scripts/host/configure.sh"
