#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
lock_deployment
command -v docker >/dev/null || die "需要 Docker Engine"; docker compose version >/dev/null || die "需要 Docker Compose v2"
RELEASE="$(cd "$HERE/.." && pwd)"; VERSION="$(tr -d 'v\r\n' < "$RELEASE/VERSION")"; TARGET="$INSTALL_DIR/releases/$VERSION"
mkdir -p "$INSTALL_DIR/releases" "$STATE_DIR"/{postgres,uploads,caddy/data,caddy/config,backups,maintenance} "$CACHE_DIR" "$CONFIG_DIR"
PENDING="$STATE_DIR/deployment/install-pending"
ORIGINAL_CURRENT="$(readlink -f "$INSTALL_DIR/current" 2>/dev/null || true)"
[[ -d "$ORIGINAL_CURRENT" ]] || ORIGINAL_CURRENT=""
if [[ -n "$ORIGINAL_CURRENT" && ! -f "$PENDING" ]]; then
  die "已有安装，请使用当前版本的 scripts/update.sh 升级"
fi
if [[ -f "$PENDING" ]]; then
  [[ "$(cat "$PENDING")" == "$TARGET" ]] || die "另一个版本安装未完成，请先处理 $PENDING"
  [[ -f "$TARGET/VERSION" && "$(tr -d 'v\r\n' < "$TARGET/VERSION")" == "$VERSION" ]] || die "未完成的版本目录不完整"
else
  if [[ "$RELEASE" != "$TARGET" ]]; then
    [[ ! -e "$TARGET" ]] || die "版本目录已存在：$TARGET"
    COPY_STAGE="$(mktemp -d "$INSTALL_DIR/releases/.install-$VERSION.XXXXXX")"
    if ! cp -a "$RELEASE/." "$COPY_STAGE/"; then
      rm -rf "$COPY_STAGE"
      die "复制发布包失败，尚未切换版本"
    fi
    mv -T "$COPY_STAGE" "$TARGET"
  fi
  printf '%s\n' "$TARGET" >"$PENDING"
fi
INSTALL_COMPLETE=0; LINK_CHANGED=0
finish_install() {
  local status=$?
  if [[ "$INSTALL_COMPLETE" != 1 ]]; then
    if [[ "$LINK_CHANGED" == 1 ]]; then
      if [[ -n "$ORIGINAL_CURRENT" ]]; then switch_link current "$ORIGINAL_CURRENT";
      else rm -f "$INSTALL_DIR/current"; fi
    fi
    deployment_phase "安装失败：v$VERSION；可重新运行同版本安装器；数据和密码已保留"
  fi
  return "$status"
}
trap finish_install EXIT
deployment_phase "准备安装：v$VERSION"
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
install_prod_dependencies "$TARGET"
prepare_release_mounts "$TARGET"
preflight_deployment "$TARGET"
deployment_phase "初始化数据库：v$VERSION"
compose "$TARGET" up -d postgres --wait
compose "$TARGET" run --rm --no-deps api node dist/migrate.mjs
switch_link current "$TARGET"; LINK_CHANGED=1
if [[ -d /run/systemd/system ]]; then
  bash "$TARGET/scripts/install-update-runner.sh"
fi
compose "$TARGET" up -d --force-recreate --wait
verify_database_access "$TARGET"
INSTALL_COMPLETE=1
rm -f "$PENDING"
deployment_phase "安装完成：v$VERSION"
log "已安装 v$VERSION"
