#!/usr/bin/env bash
# Reload Caddy after cert file change or tls mode change.
#   sudo bash /var/dafthunk/scripts/host/https-reload.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=https-common.sh
source "${SCRIPT_DIR}/https-common.sh"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Usage: sudo $0"
      echo "Re-render and restart Caddy. For fallback/manual, cert files must exist."
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_root
require_app_yml

hostname="$(read_hostname)"
mode="$(read_tls_mode)"
CERT_DIR="$(cert_dir "$hostname")"

if [[ "$mode" == "fallback" || "$mode" == "manual" ]]; then
  require_cert_files "$CERT_DIR"
fi

log "Reload Caddy (tls: ${mode})"
apply_caddy

if verify_https "$hostname"; then
  info "HTTPS https://${hostname} is up"
else
  info "Caddy restarted; HTTPS not responding yet — check docker logs"
fi

if [[ "$mode" == "manual" ]]; then
  info "Manual mode: replace pem files then re-run this script."
fi
