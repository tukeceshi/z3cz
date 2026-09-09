#!/usr/bin/env bash
# Step 1: Docker/Git + swap + clone repo.
#   curl -fsSL .../bootstrap-install | sudo bash
#   或: curl -fsSL ".../bootstrap.sh" -o "/tmp/bootstrap.sh" && sudo bash "/tmp/bootstrap.sh"
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
REPO="${DAFTHUNK_REPO:-https://github.com/tukeceshi/z3cz.git}"
BRANCH="${DAFTHUNK_BRANCH:-main}"
RAW_BASE="${DAFTHUNK_RAW_BASE:-https://raw.githubusercontent.com/tukeceshi/z3cz/main/scripts/host}"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

GITHUB_MIRROR="${DAFTHUNK_GITHUB_MIRROR:-https://ghfast.top/}"
GITHUB_MIRROR="${GITHUB_MIRROR%/}/"
REPO_TRY=()
RAW_TRY=()

github_ping_ok() {
  ping -c 1 -W 2 github.com >/dev/null 2>&1
}

github_mirror_url() {
  local url="$1"
  case "$url" in
    "${GITHUB_MIRROR}"*) printf '%s' "$url" ;;
    *) printf '%s%s' "$GITHUB_MIRROR" "$url" ;;
  esac
}

prepare_github() {
  local mirrored_repo mirrored_raw
  mirrored_repo="$(github_mirror_url "$REPO")"
  mirrored_raw="$(github_mirror_url "$RAW_BASE")"
  if github_ping_ok; then
    REPO_TRY=("$REPO")
    RAW_TRY=("$RAW_BASE")
    if [[ "$mirrored_repo" != "$REPO" ]]; then
      REPO_TRY+=("$mirrored_repo")
    fi
    if [[ "$mirrored_raw" != "$RAW_BASE" ]]; then
      RAW_TRY+=("$mirrored_raw")
    fi
  else
    info "github.com unreachable, using mirror"
    REPO_TRY=("$mirrored_repo")
    RAW_TRY=("$mirrored_raw")
    if [[ "$mirrored_repo" != "$REPO" ]]; then
      REPO_TRY+=("$REPO")
    fi
    if [[ "$mirrored_raw" != "$RAW_BASE" ]]; then
      RAW_TRY+=("$RAW_BASE")
    fi
  fi
}

mem_mib() {
  awk -v key="$1" '$1 == key ":" { print int($2 / 1024); exit }' /proc/meminfo
}

ensure_swap() {
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

# Docker Hub is the official image registry (registry-1.docker.io).
# Registry mirrors only affect docker pull; they do not install Node on the host.
ensure_docker_registry_mirrors() {
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

ensure_repo() {
  local url
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log "Updating ${INSTALL_DIR}"
    for url in "${REPO_TRY[@]}"; do
      if git -C "$INSTALL_DIR" fetch --depth 1 "$url" "$BRANCH"; then
        git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
        return 0
      fi
    done
    die "git fetch failed"
  fi
  if [[ -e "$INSTALL_DIR" ]]; then
    mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
  fi
  for url in "${REPO_TRY[@]}"; do
    log "Cloning ${url}"
    if git clone --branch "$BRANCH" --depth 1 "$url" "$INSTALL_DIR"; then
      return 0
    fi
    rm -rf "$INSTALL_DIR"
  done
  die "git clone failed"
}

curl_host_script() {
  local name="$1" dest="$2" base
  for base in "${RAW_TRY[@]}"; do
    if curl -fsSL --connect-timeout 15 "${base}/${name}" -o "$dest"; then
      return 0
    fi
  done
  return 1
}

sync_host_scripts() {
  need_cmd curl || return 0
  local dir="${INSTALL_DIR}/scripts/host"
  mkdir -p "$dir"
  log "Syncing scripts/host from GitHub"
  for name in bootstrap configure https-setup deploy update https-fallback https-reload https-try-auto https-renew-hook; do
    if curl_host_script "${name}.sh" "${dir}/${name}.sh"; then
      chmod +x "${dir}/${name}.sh"
    else
      info "Skip ${name}.sh (not on GitHub yet — use git pull after clone)"
    fi
  done
  if curl_host_script "https-common.sh" "${dir}/https-common.sh"; then
    :
  else
    info "Skip https-common.sh (use git pull after clone)"
  fi
}

log "Bootstrap"
ensure_packages
ensure_docker_registry_mirrors
ensure_swap
prepare_github
ensure_repo
sync_host_scripts
info "Done. Next: sudo bash ${INSTALL_DIR}/scripts/host/configure.sh"
info "Then: sudo bash ${INSTALL_DIR}/scripts/host/https-setup.sh"
