#!/usr/bin/env bash
# Download latest deploy pack, load images, then start.
#   sudo bash /var/dafthunk/scripts/host/update.sh
#   sudo bash /var/dafthunk/scripts/host/update.sh --detach
#   sudo bash /var/dafthunk/scripts/host/update.sh --reset
#   sudo bash /var/dafthunk/scripts/host/update.sh --reset -y
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
# shellcheck source=postgres-data-dir.sh
source "${INSTALL_DIR}/scripts/host/postgres-data-dir.sh"
ARCHIVE_URL="${DAFTHUNK_ARCHIVE:-https://github.com/tukeceshi/z3cz/releases/download/self-host/z3cz-deploy.tar.gz}"
DETACH=0
RESET=0
ASSUME_YES=0
DEPLOY_ARGS=()

log() { printf '==> %s\n' "$*" >&2; }
info() { printf ' -> %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

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
  info "Checking GitHub..."
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

load_packaged_images() {
  local f found=0
  [[ -d "${INSTALL_DIR}/images" ]] || die "Deploy pack missing images/"
  for f in "${INSTALL_DIR}/images/"*.tar.gz; do
    [[ -f "$f" ]] || continue
    found=1
    log "Loading $(basename "$f")"
    gzip -dc "$f" | docker load
  done
  [[ "$found" -eq 1 ]] || die "Deploy pack has no image files"
  rm -rf "${INSTALL_DIR}/images"
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
        load_packaged_images
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach)
      DETACH=1
      DEPLOY_ARGS+=(--detach)
      shift
      ;;
    --reset)
      RESET=1
      shift
      ;;
    -y|--yes)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: sudo bash update.sh [options]

  (default)       download pack → load images → start
  --detach        start in tmux (passed to deploy.sh)
  --reset         stop stack, wipe DB + uploads, refresh pack, start
                  (keeps containers/app.yml and HTTPS certs)
  -y, --yes       skip confirmation (for --reset)
EOF
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -d "$INSTALL_DIR" ]] || die "Install dir missing: ${INSTALL_DIR}"

log "Update ${INSTALL_DIR}"

reset_install() {
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    printf '将删除数据库与上传文件，保留域名配置与证书。输入 yes 继续: ' >&2
    read -r confirm
    [[ "$confirm" == "yes" ]] || die "Aborted"
  fi

  if [[ -x "${HOST_DIR}/launcher" && -f "${HOST_DIR}/containers/app.yml" ]]; then
    log "stop stack"
    (cd "$HOST_DIR" && ./launcher destroy) || true
  else
    info "Skip launcher destroy (missing launcher or app.yml)"
  fi

  log "wipe shared data (postgres, storage)"
  reset_postgres_data_dir "${HOST_DIR}/shared/postgres"
  rm -rf "${HOST_DIR}/shared/storage"/*
  mkdir -p "${HOST_DIR}/shared/storage"

  log "Downloading deploy pack"
  download_and_extract_pack
}

if [[ "$RESET" -eq 1 ]]; then
  reset_install
else
  log "Downloading deploy pack"
  info "Overwrites host files (not app.yml / certs)"
  download_and_extract_pack
fi

log "deploy"
exec bash "${INSTALL_DIR}/scripts/host/deploy.sh" "${DEPLOY_ARGS[@]+"${DEPLOY_ARGS[@]}"}"
