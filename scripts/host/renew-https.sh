#!/usr/bin/env bash
# Delete Caddy certs and re-enable HTTPS (rebuilds www/app + recreates caddy).
#   sudo bash /var/dafthunk/scripts/host/renew-https.sh
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
APP_YML="${HOST_DIR}/containers/app.yml"
CERT_DIR="${HOST_DIR}/shared/caddy/caddy/certificates"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
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

log "Renew HTTPS certificate for ${hostname}"
warn "Let's Encrypt may rate-limit repeated requests — wait 7 days if you hit the limit."

sed -i 's/^https:[[:space:]]*false/https: true/' "$APP_YML"
sed -i "s|http://${hostname}|https://${hostname}|g" "$APP_YML"

if [[ -d "$CERT_DIR" ]]; then
  info "Removing old certificates: $CERT_DIR"
  rm -rf "$CERT_DIR"
fi

cd "$HOST_DIR"
./launcher render
info "Rebuilding www and app..."
compose build www
compose build app
info "Recreating caddy (will request a new certificate)..."
compose up -d --force-recreate caddy api www app

info "Site: https://${hostname}"
info "If HTTPS still fails: sudo docker logs dafthunk-host-caddy-1 2>&1 | tail -30"
