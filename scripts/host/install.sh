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
  SITE_ADDRESS="$(resolve_site_address)"; SITE_TOKEN="$(openssl rand -hex 32)"; umask 077
  if [[ "$SITE_ADDRESS" == ":80" ]]; then
    log "未配置域名，Caddy 监听 HTTP 80"
  else
    log "站点域名 ${SITE_ADDRESS}，Caddy 将申请并续期证书"
  fi
  db_svc="$(compose_database_service "$TARGET/compose.yml")"
  uploads_dest="$(compose_api_mount_dest "$TARGET/compose.yml" "/uploads:")"
  assets_dest="$(compose_api_mount_dest "$TARGET/compose.yml" "/app:/")"
  [[ -n "$db_svc" && -n "$uploads_dest" && -n "$assets_dest" ]] || die "无法从 compose 读取数据库服务或挂载路径"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
RUNTIME=docker
HOST=0.0.0.0
PORT=3001
DATABASE_URL=postgresql://z3cz:${DB_PASSWORD}@${db_svc}:5432/z3cz
LOCAL_STORAGE_PATH=${uploads_dest}
API_BOOT_CACHE_DIR=${uploads_dest}/cache
BOOTSTRAP_ASSETS_DIR=${assets_dest}
Z3CZ_MAINTENANCE_FILE=/var/lib/z3cz/maintenance/enabled
RUN_DB_MIGRATE=false
Z3CZ_SITE_ADDRESS=${SITE_ADDRESS}
Z3CZ_SITE_ADDRESS_TOKEN=${SITE_TOKEN}
Z3CZ_SITE_ADDRESS_SOCKET=${SITE_SOCKET}
JWT_SECRET=${JWT_SECRET}
SECRET_MASTER_KEY=${MASTER_KEY}
EOF
  if [[ -n "${Z3CZ_PUBLIC_URL:-}" ]]; then
    printf 'WEB_HOST=%s\nWEBSITE_URL=%s\n' "$Z3CZ_PUBLIC_URL" "$Z3CZ_PUBLIC_URL" >>"$ENV_FILE"
  elif [[ "$SITE_ADDRESS" != ":80" ]]; then
    printf 'WEB_HOST=%s\nWEBSITE_URL=%s\n' "https://${SITE_ADDRESS}" "https://${SITE_ADDRESS}" >>"$ENV_FILE"
  fi
fi
chmod 600 "$ENV_FILE" "$CONFIG_DIR/postgres.password"
prepare_docker_env "$TARGET/compose.yml"
ensure_site_address_access
install_prod_dependencies "$TARGET"; switch_link current "$TARGET"
compose "$TARGET" up -d postgres --wait
compose "$TARGET" run --rm --no-deps api node dist/migrate.mjs
compose "$TARGET" up -d --force-recreate --wait
if command -v systemctl >/dev/null 2>&1; then
  bash "$TARGET/scripts/install-update-runner.sh"
  compose "$TARGET" up -d --force-recreate --wait api
fi
log "已安装 v$VERSION"
