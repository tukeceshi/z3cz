#!/usr/bin/env bash
# Step 3: Obtain TLS certs before deploy (acme.sh LE → ZeroSSL → manual hint).
#   sudo bash /var/dafthunk/scripts/host/https-setup.sh
#   sudo bash .../https-setup.sh --caddy-only    # skip pre-issue; Caddy auto on deploy
#   sudo bash .../https-setup.sh --zerossl-only  # emergency / post-deploy fallback
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=https-common.sh
source "${SCRIPT_DIR}/https-common.sh"

CADDY_ONLY=0
ZEROSSL_ONLY=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --caddy-only|--skip) CADDY_ONLY=1; shift ;;
    --zerossl-only) ZEROSSL_ONLY=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help)
      cat <<EOF
Usage: sudo [ACME_EMAIL=addr] $0 [options]

Obtain HTTPS certs before deploy (Let's Encrypt, then ZeroSSL).
Writes shared/caddy/certs/<domain>/ and sets tls: fallback on success.

Options:
  --caddy-only     Skip pre-issue; keep tls: auto for Caddy on deploy
  --zerossl-only   Skip LE; try ZeroSSL only (post-deploy fallback)
  --force          Re-issue even if valid cert files exist
EOF
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_root
require_app_yml

hostname="$(read_hostname)"
[[ -n "$hostname" ]] || die "hostname missing in $APP_YML"

mode="$(read_tls_mode)"
CERT_DIR="$(cert_dir "$hostname")"
ACME_EMAIL="${ACME_EMAIL:-admin@${hostname}}"

log "HTTPS setup for ${hostname} (tls: ${mode})"

if [[ "$CADDY_ONLY" == "1" ]]; then
  info "Skipped — Caddy will obtain certs after deploy (tls: auto)"
  info "Next: sudo bash ${INSTALL_DIR}/scripts/host/deploy.sh"
  exit 0
fi

if [[ "$mode" == "manual" ]]; then
  require_cert_files "$CERT_DIR"
  info "Manual cert files present"
  info "Next: sudo bash ${INSTALL_DIR}/scripts/host/deploy.sh"
  exit 0
fi

if cert_files_valid "$CERT_DIR" && [[ "$FORCE" != "1" ]]; then
  info "Valid cert files already in ${CERT_DIR}"
  if [[ "$mode" == "auto" ]]; then
    set_tls_mode fallback
    info "Set tls: fallback to use existing cert files on deploy"
  fi
  apply_caddy_if_running
  info "Next: sudo bash ${INSTALL_DIR}/scripts/host/deploy.sh"
  exit 0
fi

ensure_acme "$ACME_EMAIL"
ensure_port_80_free

issued=0
if [[ "$ZEROSSL_ONLY" != "1" ]]; then
  log "Trying Let's Encrypt (acme.sh standalone)"
  if issue_acme_standalone "$hostname" le; then
    issued=1
  else
    warn "Let's Encrypt failed (rate limit or validation)"
  fi
fi

if [[ "$issued" != "1" ]]; then
  log "Trying ZeroSSL (acme.sh standalone)"
  ensure_port_80_free
  if issue_acme_standalone "$hostname" zerossl; then
    issued=1
  else
    warn "ZeroSSL failed"
  fi
fi

if [[ "$issued" != "1" ]]; then
  start_caddy
  print_manual_instructions "$hostname" "$CERT_DIR"
  exit 1
fi

copy_acme_to_cert_dir "$hostname" "$CERT_DIR" || die "Could not copy cert files"
install_acme_renew_hook "$hostname" "$CERT_DIR" "${SCRIPT_DIR}/https-renew-hook.sh"
set_tls_mode fallback

info "Wrote certs to ${CERT_DIR} (tls: fallback)"
apply_caddy_if_running

if [[ -f "$COMPOSE" ]] && verify_https "$hostname"; then
  info "HTTPS https://${hostname} is up"
else
  info "Certs ready — run deploy if stack is not up yet"
fi

info "Next: sudo bash ${INSTALL_DIR}/scripts/host/deploy.sh"
info "Renewal will try Caddy auto first, then renew fallback cert."
