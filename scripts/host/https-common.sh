# Shared helpers for HTTPS scripts.
INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
APP_YML="${HOST_DIR}/containers/app.yml"
COMPOSE="${HOST_DIR}/docker-compose.generated.yml"
ENV_FILE="${HOST_DIR}/.env.generated"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo)"
}

require_app_yml() {
  [[ -f "$APP_YML" ]] || die "Missing $APP_YML — run configure.sh first"
}

read_hostname() {
  grep -E '^hostname:' "$APP_YML" | head -1 | sed 's/^hostname:[[:space:]]*//'
}

read_tls_mode() {
  grep -E '^tls:' "$APP_YML" | head -1 | sed 's/^tls:[[:space:]]*//' || echo "auto"
}

cert_dir() {
  local hostname="$1"
  echo "${HOST_DIR}/shared/caddy/certs/${hostname}"
}

set_tls_mode() {
  local mode="$1"
  if grep -qE '^tls:' "$APP_YML"; then
    sed -i "s/^tls:.*/tls: ${mode}/" "$APP_YML"
  else
    sed -i "/^https:[[:space:]]*true/a tls: ${mode}" "$APP_YML"
  fi
}

apply_caddy() {
  [[ -x "${HOST_DIR}/launcher" ]] || die "Missing ${HOST_DIR}/launcher"
  cd "$HOST_DIR"
  ./launcher render
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --force-recreate caddy
}

verify_https() {
  local hostname="$1"
  local code
  code="$(curl -sI -m 20 "https://${hostname}" 2>/dev/null | awk 'NR==1{print $2}')"
  [[ -n "$code" ]]
}

require_cert_files() {
  local dir="$1"
  [[ -f "${dir}/fullchain.pem" && -f "${dir}/privkey.pem" ]] \
    || die "Missing ${dir}/fullchain.pem or privkey.pem"
}

stop_caddy() {
  [[ -f "$COMPOSE" && -f "$ENV_FILE" ]] || return 0
  cd "$HOST_DIR"
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" stop caddy 2>/dev/null || true
}

start_caddy() {
  [[ -f "$COMPOSE" && -f "$ENV_FILE" ]] || return 0
  cd "$HOST_DIR"
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" start caddy 2>/dev/null || true
}
