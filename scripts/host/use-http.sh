#!/usr/bin/env bash
# Switch running site to HTTP-only (keeps secrets; rebuilds www/app).
#   sudo bash /var/dafthunk/scripts/host/use-http.sh
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
APP_YML="${HOST_DIR}/containers/app.yml"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)"
[[ -f "$APP_YML" ]] || die "Missing $APP_YML"
[[ -x "${HOST_DIR}/launcher" ]] || die "Missing ${HOST_DIR}/launcher"

hostname="$(grep -E '^hostname:' "$APP_YML" | head -1 | sed 's/^hostname:[[:space:]]*//')"
[[ -n "$hostname" ]] || die "Could not read hostname from app.yml"

compose() {
  local compose_file="${HOST_DIR}/docker-compose.generated.yml"
  local env_file="${HOST_DIR}/.env.generated"
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$compose_file" --env-file "$env_file" "$@"
  else
    docker-compose -f "$compose_file" --env-file "$env_file" "$@"
  fi
}

log "Switch to HTTP-only"
sed -i 's/^https:[[:space:]]*true/https: false/' "$APP_YML"
sed -i "s|https://${hostname}|http://${hostname}|g" "$APP_YML"

cd "$HOST_DIR"
./launcher render
info "Rebuilding api, www and app..."
compose build api
compose build www
compose build app
info "Recreating caddy and api (apply HTTP config)..."
compose up -d --force-recreate caddy api www app

info "Site: http://${hostname}"
