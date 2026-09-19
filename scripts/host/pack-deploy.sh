#!/usr/bin/env bash
# Build api/app images, push to Docker Hub, pack host scripts (no image tarballs).
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

build_images() {
  log "Building ${API_IMAGE}"
  docker build \
    --target prod-api \
    -t "$API_IMAGE" \
    --build-arg VITE_API_HOST=/api \
    --build-arg VITE_WS_VIA_PROXY=1 \
    --build-arg VITE_WEBSITE_URL=http://localhost:3101 \
    --build-arg VITE_APP_URL=http://localhost:3101 \
    "$ROOT"

  log "Building ${APP_IMAGE}"
  docker build \
    --target prod-app \
    -t "$APP_IMAGE" \
    --build-arg VITE_API_HOST=/api \
    --build-arg VITE_WS_VIA_PROXY=1 \
    --build-arg VITE_WEBSITE_URL=http://localhost:3101 \
    --build-arg VITE_APP_URL=http://localhost:3101 \
    "$ROOT"
}

push_images() {
  if [[ "${DAFTHUNK_PUSH_IMAGES:-}" != "1" ]]; then
    log "Skip Docker Hub push (set DAFTHUNK_PUSH_IMAGES=1 to push)"
    return 0
  fi
  log "Pushing ${API_IMAGE}"
  docker push "$API_IMAGE"
  log "Pushing ${APP_IMAGE}"
  docker push "$APP_IMAGE"
  if git -C "$ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    local sha api_sha app_sha
    sha="$(git -C "$ROOT" rev-parse --short HEAD)"
    api_sha="${API_IMAGE%:*}:${sha}"
    app_sha="${APP_IMAGE%:*}:${sha}"
    docker tag "$API_IMAGE" "$api_sha"
    docker tag "$APP_IMAGE" "$app_sha"
    log "Pushing ${api_sha}"
    docker push "$api_sha"
    log "Pushing ${app_sha}"
    docker push "$app_sha"
  fi
  if [[ -n "$VERSION_TAG" ]]; then
    docker tag "$API_IMAGE" "tukeceshi/z3cz-api:latest"
    docker tag "$APP_IMAGE" "tukeceshi/z3cz-app:latest"
    log "Pushing tukeceshi/z3cz-api:latest"
    docker push "tukeceshi/z3cz-api:latest"
    log "Pushing tukeceshi/z3cz-app:latest"
    docker push "tukeceshi/z3cz-app:latest"
  fi
}

copy_host_files() {
  local stage="$1"
  mkdir -p \
    "$stage/scripts/host/updater" \
    "$stage/docker-host/lib" \
    "$stage/docker-host/samples" \
    "$stage/docker/nginx"

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
  chmod +x "$stage/scripts/host/"*.sh "$stage/docker-host/launcher" "$stage/docker-host/dafthunk-setup"
  cp "$ROOT/VERSION" "$stage/VERSION"
  cp "$ROOT/CHANGELOG.md" "$stage/CHANGELOG.md"
  if git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1; then
    git -C "$ROOT" rev-parse HEAD >"$stage/DEPLOY_REVISION"
  else
    date -u +"%Y-%m-%dT%H:%M:%SZ" >"$stage/DEPLOY_REVISION"
  fi
  printf 'API_IMAGE=%s\nAPP_IMAGE=%s\n' "$API_IMAGE" "$APP_IMAGE" \
    >"$stage/docker-host/packaged-images.env"
}

build_images
push_images
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
copy_host_files "$STAGE"
log "Writing ${OUT}"
tar -czf "$OUT" -C "$STAGE" .
log "Done"
