# Shared helpers for HTTPS scripts.

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
APP_YML="${HOST_DIR}/containers/app.yml"
COMPOSE="${HOST_DIR}/docker-compose.generated.yml"
ENV_FILE="${HOST_DIR}/.env.generated"
ACME_HOME="${HOME}/.acme.sh"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
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

apply_caddy_if_running() {
  [[ -f "$COMPOSE" && -f "$ENV_FILE" ]] || return 0
  apply_caddy
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

cert_files_valid() {
  local dir="$1"
  [[ -f "${dir}/fullchain.pem" && -f "${dir}/privkey.pem" ]] \
    && openssl x509 -in "${dir}/fullchain.pem" -noout -checkend 86400 >/dev/null 2>&1
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

ensure_port_80_free() {
  stop_caddy
  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -qE ':80(\s|$)'; then
    die "Port 80 is in use — stop the service on :80 and re-run"
  fi
}

ensure_acme() {
  local email="$1"
  if [[ ! -x "${ACME_HOME}/acme.sh" ]]; then
    log "Installing acme.sh"
    curl -fsSL https://get.acme.sh | sh -s "email=${email}"
  fi
  # shellcheck source=/dev/null
  source "${ACME_HOME}/acme.sh.env"
}

issue_acme_standalone() {
  local hostname="$1"
  local ca="$2"
  if [[ "$ca" == "zerossl" ]]; then
    "${ACME_HOME}/acme.sh" --set-default-ca --server zerossl
  else
    "${ACME_HOME}/acme.sh" --set-default-ca --server letsencrypt
  fi
  "${ACME_HOME}/acme.sh" --issue -d "$hostname" --standalone --force
}

copy_acme_to_cert_dir() {
  local hostname="$1"
  local dest="$2"
  local domain_dir="${ACME_HOME}/${hostname}_ecc"
  [[ -d "$domain_dir" ]] || domain_dir="${ACME_HOME}/${hostname}"
  [[ -f "${domain_dir}/fullchain.cer" ]] || return 1
  mkdir -p "$dest"
  install -m 644 "${domain_dir}/fullchain.cer" "${dest}/fullchain.pem"
  install -m 600 "${domain_dir}/${hostname}.key" "${dest}/privkey.pem"
}

install_acme_renew_hook() {
  local hostname="$1"
  local dest="$2"
  local hook_script="$3"
  "${ACME_HOME}/acme.sh" --install-cert -d "$hostname" \
    --cert-file "${dest}/fullchain.pem" \
    --key-file "${dest}/privkey.pem" \
    --fullchain-file "${dest}/fullchain.pem" \
    --reloadcmd "bash ${hook_script}"
}

print_manual_instructions() {
  local hostname="$1"
  local cert_path="$2"
  cat >&2 <<EOF
Manual mode:
  1. Upload certs to:
       ${cert_path}/fullchain.pem
       ${cert_path}/privkey.pem
  2. Set tls: manual in ${APP_YML}
  3. sudo bash ${INSTALL_DIR}/scripts/host/https-reload.sh
     (or run https-setup.sh again after upload)
EOF
}
