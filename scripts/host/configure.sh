#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/opt/z3cz}"
STATE_DIR="${DAFTHUNK_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${DAFTHUNK_CONFIG_DIR:-/etc/z3cz}"
ENV_FILE="${CONFIG_DIR}/z3cz.env"
HOSTNAME="${DAFTHUNK_HOSTNAME:-}"
FORCE=0
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
secret() { openssl rand -hex 32; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --domain) HOSTNAME="${2:-}"; shift 2 ;;
    -h|--help) echo "Usage: sudo $0 [--domain example.com] [--force]"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done
[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"
if [[ -f "$ENV_FILE" && "$FORCE" != 1 ]]; then info "保留现有配置：$ENV_FILE"; exit 0; fi
if [[ -z "$HOSTNAME" && -r /dev/tty ]]; then
  printf '公网域名（留空使用 HTTP 初始化）: ' >/dev/tty
  read -r HOSTNAME </dev/tty || true
fi
HOSTNAME="${HOSTNAME//[[:space:]]/}"
if [[ -n "$HOSTNAME" ]]; then ORIGIN="https://${HOSTNAME}"; else ORIGIN="http://$(hostname -I | awk '{print $1}')"; fi
mkdir -p "$CONFIG_DIR" "$STATE_DIR/storage" "$STATE_DIR/maintenance"
DB_PASSWORD="$(secret)"; JWT_SECRET="$(secret)"; MASTER_KEY="$(secret)"; UPDATER_TOKEN="$(secret)"
umask 077
{
  echo "NODE_ENV=production"
  echo "RUNTIME=native"
  echo "HOST=127.0.0.1"
  echo "PORT=3001"
  echo "DATABASE_URL=postgresql://z3cz:${DB_PASSWORD}@127.0.0.1:5432/z3cz"
  echo "LOCAL_STORAGE_PATH=${STATE_DIR}/storage"
  echo "API_BOOT_CACHE_DIR=${STATE_DIR}/storage/cache"
  echo "BOOTSTRAP_ASSETS_DIR=${INSTALL_DIR}/current/app"
  echo "Z3CZ_MAINTENANCE_FILE=${STATE_DIR}/maintenance/enabled"
  echo "RUN_DB_MIGRATE=false"
  echo "WEB_HOST=${ORIGIN}"
  echo "WEBSITE_URL=${ORIGIN}"
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "SECRET_MASTER_KEY=${MASTER_KEY}"
  echo "UPDATER_TOKEN=${UPDATER_TOKEN}"
} >"$ENV_FILE"
chmod 0600 "$ENV_FILE"
printf '%s' "$DB_PASSWORD" >"${CONFIG_DIR}/postgres.password"
chmod 0600 "${CONFIG_DIR}/postgres.password"
printf '%s\n' "$HOSTNAME" >"${CONFIG_DIR}/hostname"
info "已写入 $ENV_FILE"
