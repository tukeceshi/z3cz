#!/usr/bin/env bash
# Compile the host updater to linux amd64/arm64 binaries.
#   bash scripts/host/compile-updater.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="${ROOT}/dist"
ENTRY="${ROOT}/scripts/host/updater/main.mjs"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ENTRY" ]] || die "Missing ${ENTRY}"
mkdir -p "$DIST"

bun_build() {
  local target="$1" outfile="$2"
  if command -v bun >/dev/null 2>&1; then
    bun build --compile --target="$target" "$ENTRY" --outfile "$outfile"
    return 0
  fi
  command -v docker >/dev/null 2>&1 || die "Need bun or docker to compile the host updater"
  log "bun not found, compiling with oven/bun"
  docker run --rm \
    -v "${ROOT}:/src" \
    -w /src \
    oven/bun:1.2 \
    bun build --compile --target="$target" /src/scripts/host/updater/main.mjs \
    --outfile "/src/dist/$(basename "$outfile")"
}

log "Compiling host updater"
bun_build bun-linux-x64 "${DIST}/z3cz-host-updater-linux-amd64"
bun_build bun-linux-arm64 "${DIST}/z3cz-host-updater-linux-arm64"
chmod +x "${DIST}/z3cz-host-updater-linux-amd64" "${DIST}/z3cz-host-updater-linux-arm64"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$DIST" && sha256sum z3cz-host-updater-linux-amd64 z3cz-host-updater-linux-arm64 > SHA256SUMS)
else
  (
    cd "$DIST"
    printf '%s  %s\n' "$(openssl dgst -sha256 z3cz-host-updater-linux-amd64 | awk '{print $NF}')" z3cz-host-updater-linux-amd64
    printf '%s  %s\n' "$(openssl dgst -sha256 z3cz-host-updater-linux-arm64 | awk '{print $NF}')" z3cz-host-updater-linux-arm64
  ) > "${DIST}/SHA256SUMS"
fi

log "Wrote ${DIST}/z3cz-host-updater-linux-amd64"
log "Wrote ${DIST}/z3cz-host-updater-linux-arm64"
log "Wrote ${DIST}/SHA256SUMS"
