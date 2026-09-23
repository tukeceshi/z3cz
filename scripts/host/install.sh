#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
command -v docker >/dev/null || die "需要 Docker Engine"; docker compose version >/dev/null || die "需要 Docker Compose v2"
RELEASE="$(cd "$HERE/.." && pwd)"; VERSION="$(tr -d 'v\r\n' < "$RELEASE/VERSION")"; TARGET="$INSTALL_DIR/releases/$VERSION"
mkdir -p "$INSTALL_DIR/releases" "$STATE_DIR"/{postgres,uploads,caddy/data,caddy/config,backups,maintenance} "$CACHE_DIR" "$CONFIG_DIR"
if [[ "$RELEASE" != "$TARGET" ]]; then [[ ! -e "$TARGET" ]] || die "版本目录已存在：$TARGET"; cp -a "$RELEASE" "$TARGET"; fi
if [[ ! -f "$CONFIG_DIR/postgres.password" ]]; then umask 077; openssl rand -hex 32 > "$CONFIG_DIR/postgres.password"; fi
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASSWORD="$(cat "$CONFIG_DIR/postgres.password")"; JWT_SECRET="$(openssl rand -hex 32)"; MASTER_KEY="$(openssl rand -hex 32)"
  SITE_ADDRESS="${Z3CZ_SITE_ADDRESS:-:80}"; umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
RUNTIME=docker
HOST=0.0.0.0
PORT=3001
DATABASE_URL=postgresql://z3cz:${DB_PASSWORD}@postgres:5432/z3cz
LOCAL_STORAGE_PATH=/var/lib/z3cz/uploads
BOOTSTRAP_ASSETS_DIR=/srv/app
Z3CZ_MAINTENANCE_FILE=/var/lib/z3cz/maintenance/enabled
RUN_DB_MIGRATE=false
Z3CZ_SITE_ADDRESS=${SITE_ADDRESS}
WEB_HOST=${Z3CZ_PUBLIC_URL:-http://localhost}
WEBSITE_URL=${Z3CZ_PUBLIC_URL:-http://localhost}
JWT_SECRET=${JWT_SECRET}
SECRET_MASTER_KEY=${MASTER_KEY}
EOF
fi
chmod 600 "$ENV_FILE" "$CONFIG_DIR/postgres.password"
install_prod_dependencies "$TARGET"; switch_link current "$TARGET"
compose "$TARGET" up -d postgres --wait
compose "$TARGET" run --rm --no-deps api node dist/migrate.mjs
compose "$TARGET" up -d --force-recreate --wait
log "已安装 v$VERSION"
