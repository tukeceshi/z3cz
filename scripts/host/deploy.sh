#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/opt/z3cz}"
STATE_DIR="${DAFTHUNK_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${DAFTHUNK_CONFIG_DIR:-/etc/z3cz}"
ENV_FILE="${CONFIG_DIR}/z3cz.env"
SERVICE=/etc/systemd/system/z3cz-api.service
log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"
[[ -f "$ENV_FILE" ]] || die "缺少 $ENV_FILE，请先运行 configure.sh"
[[ -x "${INSTALL_DIR}/current/node/bin/node" ]] || die "部署包缺少 Node.js 运行时"

log "初始化 PostgreSQL"
systemctl enable --now postgresql
DB_PASSWORD="$(cat "${CONFIG_DIR}/postgres.password")"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 --set=db_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE z3cz LOGIN PASSWORD %L', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'z3cz') \gexec
SELECT 'CREATE DATABASE z3cz OWNER z3cz'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'z3cz') \gexec
ALTER ROLE z3cz PASSWORD :'db_password';
SQL

log "执行数据库迁移"
bash "${INSTALL_DIR}/current/scripts/host/db-migrate.sh"

log "安装 API 服务"
cat >"$SERVICE" <<EOF
[Unit]
Description=z3cz API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=z3cz
Group=z3cz
WorkingDirectory=${INSTALL_DIR}/current/api/apps/api
EnvironmentFile=${ENV_FILE}
Environment=APP_VERSION=$(tr -d '\r\n' <"${INSTALL_DIR}/current/VERSION")
ExecStart=${INSTALL_DIR}/current/node/bin/node node_modules/tsx/dist/cli.mjs --import ./src/shims/cloudflare-register.mjs src/server.ts
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
chown -R root:root "${INSTALL_DIR}/releases"
chown -R z3cz:z3cz "$STATE_DIR"
systemctl daemon-reload
systemctl enable --now z3cz-api.service

log "配置 Caddy"
bash "${INSTALL_DIR}/current/scripts/host/render-caddy.sh"
systemctl enable --now caddy
systemctl reload caddy
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    info "API 已就绪 (${i}s)"
    SITE_HOST="$(cat "${CONFIG_DIR}/hostname")"
    [[ -n "$SITE_HOST" ]] && info "访问：https://${SITE_HOST}" || info "HTTP 初始化已启动"
    exit 0
  fi
  sleep 1
done
journalctl -u z3cz-api.service -n 80 --no-pager >&2 || true
die "API 健康检查失败"
