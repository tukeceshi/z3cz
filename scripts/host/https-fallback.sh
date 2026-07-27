#!/usr/bin/env bash
# Fallback HTTPS when Caddy / Let's Encrypt fails (deploy guidance only).
#   sudo bash /var/dafthunk/scripts/host/https-fallback.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=https-common.sh
source "${SCRIPT_DIR}/https-common.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Usage: sudo [ACME_EMAIL=addr] $0"
      echo "Issues cert via acme.sh (ZeroSSL), writes shared/caddy/certs/<domain>/, sets tls: fallback."
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_root
require_app_yml

hostname="$(read_hostname)"
[[ -n "$hostname" ]] || die "hostname missing in $APP_YML"

CERT_DIR="$(cert_dir "$hostname")"
ACME_HOME="${HOME}/.acme.sh"
ACME_EMAIL="${ACME_EMAIL:-admin@${hostname}}"

log "HTTPS fallback (acme.sh + ZeroSSL) for ${hostname}"

if [[ ! -x "${ACME_HOME}/acme.sh" ]]; then
  log "Installing acme.sh"
  curl -fsSL https://get.acme.sh | sh -s "email=${ACME_EMAIL}"
fi
# shellcheck source=/dev/null
source "${ACME_HOME}/acme.sh.env"

"${ACME_HOME}/acme.sh" --set-default-ca --server zerossl

log "Stopping Caddy (standalone needs :80)"
stop_caddy

if ! "${ACME_HOME}/acme.sh" --issue -d "$hostname" --standalone --force; then
  start_caddy
  cat >&2 <<EOF
ERROR: Fallback issue failed — switch to manual mode:
  1. Upload certs to:
       ${CERT_DIR}/fullchain.pem
       ${CERT_DIR}/privkey.pem
  2. Set tls: manual in ${APP_YML}
  3. sudo bash ${SCRIPT_DIR}/https-reload.sh
EOF
  exit 1
fi

mkdir -p "$CERT_DIR"
domain_dir="${ACME_HOME}/${hostname}_ecc"
[[ -d "$domain_dir" ]] || domain_dir="${ACME_HOME}/${hostname}"
[[ -f "${domain_dir}/fullchain.cer" ]] || die "Cert files missing under ${domain_dir}"

install -m 644 "${domain_dir}/fullchain.cer" "${CERT_DIR}/fullchain.pem"
install -m 600 "${domain_dir}/${hostname}.key" "${CERT_DIR}/privkey.pem"

"${ACME_HOME}/acme.sh" --install-cert -d "$hostname" \
  --cert-file "${CERT_DIR}/fullchain.pem" \
  --key-file "${CERT_DIR}/privkey.pem" \
  --fullchain-file "${CERT_DIR}/fullchain.pem" \
  --reloadcmd "bash ${SCRIPT_DIR}/https-renew-hook.sh"

set_tls_mode fallback
apply_caddy

if verify_https "$hostname"; then
  info "HTTPS https://${hostname} is up (tls: fallback)"
else
  info "Cert installed; check: sudo docker logs dafthunk-host-caddy-1 2>&1 | tail -30"
fi

info "Renewal will try Caddy auto first, then renew fallback cert."
