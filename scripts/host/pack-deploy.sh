#!/usr/bin/env bash
# Publish a reusable base environment and pack the source updater.
#   DAFTHUNK_PUSH_IMAGES=1 bash scripts/host/pack-deploy.sh [outfile]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-$ROOT/z3cz-deploy.tar.gz}"
API_IMAGE="${DAFTHUNK_API_IMAGE:-tukeceshi/z3cz-api:latest}"
APP_IMAGE="${DAFTHUNK_APP_IMAGE:-tukeceshi/z3cz-app:latest}"
VERSION_TAG=""
if [[ "${DAFTHUNK_RELEASE:-}" == "1" && -f "$ROOT/VERSION" ]]; then
  VERSION_TAG="$(tr -d 'v \r\n' < "$ROOT/VERSION")"
  API_IMAGE="tukeceshi/z3cz-api:${VERSION_TAG}"
  APP_IMAGE="tukeceshi/z3cz-app:${VERSION_TAG}"
fi

log() { printf '==> %s\n' "$*"; }

build_runtime() {
  local hash image
  hash="$(tr -d '\r' < "$ROOT/docker/Dockerfile.source" | sha256sum | cut -c1-20)"
  image="tukeceshi/z3cz-runtime:env-${hash}"
  if [[ "${DAFTHUNK_PUSH_IMAGES:-}" == "1" ]]; then
    if docker manifest inspect "$image" >/dev/null 2>&1; then
      log "Reusing base environment $image"
    else
      docker buildx build --platform linux/amd64,linux/arm64 -f "$ROOT/docker/Dockerfile.source" -t "$image" --push "$ROOT"
    fi
  else
    docker build -f "$ROOT/docker/Dockerfile.source" -t "$image" "$ROOT"
  fi
}

copy_host_files() {
  local stage="$1"
  mkdir -p \
    "$stage/scripts/host/updater" \
    "$stage/docker-host/lib" \
    "$stage/docker-host/samples" \
    "$stage/docker/nginx" \
    "$stage/dist"

  cp "$ROOT/scripts/host/"*.sh "$stage/scripts/host/"
  cp "$ROOT/scripts/host/updater/"*.mjs "$stage/scripts/host/updater/"
  rm -f "$stage/scripts/host/updater/"*.test.mjs
  cp "$ROOT/docker-host/launcher" "$stage/docker-host/launcher"
  cp "$ROOT/docker-host/launcher.mjs" "$stage/docker-host/launcher.mjs"
  cp "$ROOT/docker-host/dafthunk-setup" "$stage/docker-host/dafthunk-setup"
  cp "$ROOT/docker-host/dafthunk-setup.mjs" "$stage/docker-host/dafthunk-setup.mjs"
  cp "$ROOT/docker-host/samples/standalone.yml" "$stage/docker-host/samples/standalone.yml"
  cp "$ROOT/docker-host/lib/"*.mjs "$stage/docker-host/lib/"
  rm -f "$stage/docker-host/lib/"*.test.mjs
  cp "$ROOT/docker/nginx/app.static.conf" "$stage/docker/nginx/app.static.conf"
  cp "$ROOT/dist/z3cz-host-updater-linux-amd64" "$stage/dist/"
  cp "$ROOT/dist/z3cz-host-updater-linux-arm64" "$stage/dist/"
  cp "$ROOT/dist/SHA256SUMS" "$stage/dist/"
  chmod +x "$stage/scripts/host/"*.sh "$stage/docker-host/launcher" "$stage/docker-host/dafthunk-setup" \
    "$stage/dist/z3cz-host-updater-linux-amd64" "$stage/dist/z3cz-host-updater-linux-arm64"
  cp "$ROOT/VERSION" "$stage/VERSION"
  cp "$ROOT/CHANGELOG.md" "$stage/CHANGELOG.md"
  if git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1; then
    git -C "$ROOT" rev-parse HEAD >"$stage/DEPLOY_REVISION"
    cp "$stage/DEPLOY_REVISION" "$stage/SOURCE_REVISION"
  else
    date -u +"%Y-%m-%dT%H:%M:%SZ" >"$stage/DEPLOY_REVISION"
  fi
  printf 'API_IMAGE=%s\nAPP_IMAGE=%s\n' "$API_IMAGE" "$APP_IMAGE" \
    >"$stage/docker-host/packaged-images.env"
}

build_runtime
bash "${ROOT}/scripts/host/compile-updater.sh"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
copy_host_files "$STAGE"
log "Writing ${OUT}"
tar -czf "$OUT" -C "$STAGE" .
log "Done"
