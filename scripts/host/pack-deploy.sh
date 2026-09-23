#!/usr/bin/env bash
# Build self-contained native Linux release archives. No container images.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${DAFTHUNK_OUT_DIR:-$ROOT/dist/native}"
NODE_VERSION="${NODE_VERSION:-22.12.0}"
log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || die "pnpm is required"
command -v curl >/dev/null 2>&1 || die "curl is required"

log "Build frontend"
(cd "$ROOT" && VITE_API_HOST=/api VITE_WS_VIA_PROXY=1 pnpm --filter @dafthunk/app build:docker-prod)
mkdir -p "$OUT_DIR"

build_arch() {
  local arch="$1" node_arch="$2" stage node_tar asset
  stage="$(mktemp -d)"
  node_tar="$(mktemp --suffix=.tar.xz)"
  asset="z3cz-server-linux-${arch}.tar.gz"
  log "Package ${asset}"
  mkdir -p "$stage/scripts/host" "$stage/app" "$stage/node" "$stage/api/apps"
  cp "$ROOT/package.json" "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml" "$ROOT/tsconfig.json" "$stage/api/"
  cp -R "$ROOT/apps/api" "$stage/api/apps/api"
  cp -R "$ROOT/packages" "$stage/api/packages"
  (cd "$stage/api" && pnpm install --prod --frozen-lockfile)
  cp -R "$ROOT/apps/app/dist/." "$stage/app/"
  cp "$ROOT/scripts/host/bootstrap.sh" "$ROOT/scripts/host/configure.sh" \
    "$ROOT/scripts/host/deploy.sh" "$ROOT/scripts/host/db-migrate.sh" \
    "$ROOT/scripts/host/render-caddy.sh" "$ROOT/scripts/host/update.sh" \
    "$stage/scripts/host/"
  cp "$ROOT/VERSION" "$ROOT/CHANGELOG.md" "$ROOT/update-policy.json" "$stage/"
  curl -fL --retry 3 "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o "$node_tar"
  tar -xJf "$node_tar" --strip-components=1 -C "$stage/node"
  chmod +x "$stage/scripts/host/"*.sh "$stage/node/bin/node"
  tar -czf "$OUT_DIR/$asset" -C "$stage" .
  rm -rf "$stage"
  rm -f "$node_tar"
}

build_arch amd64 x64
build_arch arm64 arm64
(cd "$OUT_DIR" && sha256sum z3cz-server-linux-amd64.tar.gz z3cz-server-linux-arm64.tar.gz >SHA256SUMS)
log "Native release archives written to $OUT_DIR"
