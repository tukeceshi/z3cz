#!/usr/bin/env bash
# Try switching back to Caddy auto HTTPS (user-initiated, not in deploy guide).
#   sudo bash /var/dafthunk/scripts/host/https-try-auto.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=https-common.sh
source "${SCRIPT_DIR}/https-common.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Usage: sudo $0"
      echo "Sets tls: auto and restarts Caddy. On failure restores previous file-based mode if certs exist."
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_root
require_app_yml

hostname="$(read_hostname)"
previous="$(read_tls_mode)"
CERT_DIR="$(cert_dir "$hostname")"

log "Try Caddy auto HTTPS for ${hostname}"

set_tls_mode auto
apply_caddy

sleep 8

if verify_https "$hostname"; then
  info "Switched to tls: auto — Caddy manages certs and renewal"
  exit 0
fi

info "Caddy auto not ready yet"

if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
  restore="$previous"
  [[ "$restore" == "auto" ]] && restore="fallback"
  set_tls_mode "$restore"
  apply_caddy
  info "Restored tls: ${restore} using existing cert files"
else
  info "No fallback cert files — left tls: auto; fix DNS/ports or use manual mode"
fi

exit 1
