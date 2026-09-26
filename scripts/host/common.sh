#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${Z3CZ_INSTALL_DIR:-/opt/z3cz}"; STATE_DIR="${Z3CZ_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${Z3CZ_CONFIG_DIR:-/etc/z3cz}"; CACHE_DIR="${Z3CZ_PNPM_CACHE_DIR:-/var/cache/z3cz/pnpm}"
ENV_FILE="$CONFIG_DIR/z3cz.env"
die() { echo "ERROR: $*" >&2; exit 1; }; log() { echo "==> $*"; }
need_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"; }
compose() {
  local release="$1"; shift
  local args=("$@")
  local password_source="$CONFIG_DIR/postgres.password"
  if [[ -f "$release/password-mount.version" && -f "$CONFIG_DIR/postgres-secret/postgres.password" ]]; then
    password_source="$CONFIG_DIR/postgres-secret"
  fi
  if [[ " $* " == *" --wait "* && " $* " != *" --wait-timeout "* ]]; then
    args+=(--wait-timeout "${Z3CZ_DEPLOY_TIMEOUT:-300}")
  fi
  Z3CZ_RELEASE_DIR="$release" Z3CZ_ENV_FILE="$ENV_FILE" \
    Z3CZ_POSTGRES_PASSWORD_FILE="$password_source" \
    docker compose --env-file "$ENV_FILE" -f "$release/compose.yml" "${args[@]}"
}

# Explicit deployment preparation, not a side effect of policy validation.
# Old update.sh can still start the new template using the original file mount.
prepare_release_mounts() {
  local release="$1"
  [[ -f "$release/password-mount.version" ]] || return 0
  [[ "$(cat "$release/password-mount.version")" == 1 ]] || die "不支持的密码挂载格式"
  [[ -f "$CONFIG_DIR/postgres.password" && -s "$CONFIG_DIR/postgres.password" ]] || die "缺少原始数据库密码文件"
  mkdir -p "$CONFIG_DIR/postgres-secret"
  chmod 700 "$CONFIG_DIR/postgres-secret"
  install -m 0600 "$CONFIG_DIR/postgres.password" "$CONFIG_DIR/postgres-secret/postgres.password.next"
  mv -f "$CONFIG_DIR/postgres-secret/postgres.password.next" "$CONFIG_DIR/postgres-secret/postgres.password"
}

# One lock shared by install, update and rollback. It is inherited by children.
lock_deployment() {
  mkdir -p "$STATE_DIR/deployment"
  chmod 700 "$STATE_DIR/deployment"
  exec 9>"$STATE_DIR/deployment/lock"
  flock -n 9 || die "已有部署操作正在执行"
}

deployment_phase() {
  DEPLOY_PHASE="$*"
  printf '%s\n' "$*" >"$STATE_DIR/deployment/status.next"
  mv "$STATE_DIR/deployment/status.next" "$STATE_DIR/deployment/status"
  log "$*"
}

deployment_failed() {
  local status="$1"
  [[ "$status" == 0 ]] || deployment_phase "失败（退出码 $status）：${DEPLOY_PHASE:-部署准备}；维护状态保持不变"
}

preflight_deployment() {
  local release="$1" file
  [[ "${Z3CZ_DEPLOY_TIMEOUT:-300}" =~ ^[1-9][0-9]*$ ]] || die "Z3CZ_DEPLOY_TIMEOUT 必须为正整数秒数"
  docker info >/dev/null || die "Docker 引擎不可用"
  docker compose up --help | grep -q -- '--wait-timeout' || die "Docker Compose 需要支持 --wait-timeout"
  for file in compose.yml api/dist/server.mjs api/dist/migrate.mjs app/index.html scripts/site-address-server.mjs; do
    [[ -f "$release/$file" ]] || die "发布包缺少文件：$file"
  done
  [[ -s "$CONFIG_DIR/postgres.password" && -f "$CONFIG_DIR/postgres.password" ]] || die "数据库密码必须是非空普通文件"
  compose "$release" config --quiet
  # Resolve images and check mounts before entering maintenance or replacing services.
  compose "$release" pull
  compose "$release" run --rm --no-deps --entrypoint node api -e \
    "const fs=require('node:fs');for(const p of ['/app/dist/server.mjs','/app/dist/migrate.mjs','/srv/app/index.html'])if(!fs.statSync(p).isFile())throw Error('Invalid release mount: '+p)"
  compose "$release" run --rm --no-deps --entrypoint sh postgres -ec 'if [ -d /run/z3cz-password ]; then test -s /run/z3cz-password/postgres.password; elif [ -f /run/z3cz-password ]; then test -s /run/z3cz-password; else test -s /run/secrets/postgres_password; fi'
  compose "$release" run --rm --no-deps --entrypoint node site-address -e \
    "const fs=require('node:fs');const p=fs.existsSync('/srv/scripts/site-address-server.mjs')?'/srv/scripts/site-address-server.mjs':'/srv/site-address-server.mjs';if(!fs.statSync(p).isFile())throw Error('Invalid site-address mount')"
  compose "$release" run --rm --no-deps --entrypoint caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
}

# Older releases only expose liveness. Authenticate a query as well before
# removing maintenance, including when rolling back to an older template.
verify_database_access() {
  compose "$1" exec -T api node -e \
    "const timer=setTimeout(()=>process.exit(1),10000);import('postgres').then(async({default:postgres})=>{const sql=postgres(process.env.DATABASE_URL,{max:1,connect_timeout:2,connection:{statement_timeout:2000}});try{await sql.unsafe('SELECT 1')}finally{await sql.end({timeout:1})}}).then(()=>clearTimeout(timer)).catch(()=>process.exit(1))"
}
install_prod_dependencies() {
  local release="$1"; mkdir -p "$CACHE_DIR"
  docker run --rm \
    -v "$release/api:/app" -v "$CACHE_DIR:/pnpm/store" -w /app \
    node:22.12.0-bookworm-slim@sha256:35531c52ce27b6575d69755c73e65d4468dba93a25644eed56dc12879cae9213 \
    sh -ec 'npm install --global pnpm@10.3.0 --silent; pnpm config set store-dir /pnpm/store; pnpm install --prod --frozen-lockfile --config.auto-install-peers=false --reporter=silent'
}
switch_link() { local name="$1" target="$2"; ln -sfn "$target" "$INSTALL_DIR/$name.next"; mv -Tf "$INSTALL_DIR/$name.next" "$INSTALL_DIR/$name"; }
compose_database_service() {
  awk '
    /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { svc=$1; sub(/:$/, "", svc) }
    /^[[:space:]]+image:/ && index($0, "postgres") && svc != "" { print svc; exit }
  ' "$1"
}
compose_api_mount_dest() {
  awk -v marker="$2" '
    /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { svc=$1; sub(/:$/, "", svc); in_api=(svc=="api") }
    in_api && index($0, marker) {
      line=$0
      sub(/^[[:space:]]*-[[:space:]]*/, "", line)
      if (match(line, /:(\/[^:[:space:]]+)/)) {
        print substr(line, RSTART + 1, RLENGTH - 1)
        exit
      }
    }
  ' "$1"
}
# 空输入和 :80 都表示 HTTP 初始化：Caddy 只监听 80，不申请证书。
# 从 /dev/tty 读是因为 sudo 会清掉环境变量，也可能不把安装器的标准输入留给提问。
normalize_site_address() {
  local raw="$1"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  raw="${raw,,}"
  raw="${raw%/}"
  if [[ -z "$raw" || "$raw" == ":80" ]]; then
    printf '%s' ':80'
    return 0
  fi
  raw="${raw#http://}"
  raw="${raw#https://}"
  raw="${raw%/}"
  raw="${raw%.}"
  if [[ "$raw" == *[:/?#@]* || "$raw" == *' '* ]]; then
    echo "域名不能带端口、路径、账号或空格" >&2
    return 1
  fi
  if [[ "$raw" == "localhost" || "$raw" == "127.0.0.1" || "$raw" == "::1" || "$raw" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    echo "IP 或本机名称不能作为站点域名；直接回车可使用 HTTP 初始化" >&2
    return 1
  fi
  if [[ ${#raw} -gt 253 || ! "$raw" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
    echo "「${raw}」不是有效的公网域名" >&2
    return 1
  fi
  printf '%s' "$raw"
}
resolve_site_address() {
  if [[ -n "${Z3CZ_SITE_ADDRESS:-}" ]]; then
    normalize_site_address "$Z3CZ_SITE_ADDRESS" || die "Z3CZ_SITE_ADDRESS 无效：$Z3CZ_SITE_ADDRESS"
    return 0
  fi
  if [[ ! -r /dev/tty ]]; then
    printf '%s' ':80'
    return 0
  fi
  local raw normalized
  while true; do
    printf '\n%s' '公网域名（须已解析到本机并开放 80/443；证书未就绪或暂不配置请直接回车）: ' >/dev/tty
    raw=""
    IFS= read -r raw </dev/tty || true
    if normalized="$(normalize_site_address "$raw")"; then
      printf '%s' "$normalized"
      return 0
    fi
  done
}
# 旧的本机安装把数据库和 API 绑在回环地址。容器内改走 compose 里的服务名和挂载路径。
# 未配置域名时去掉 WEB_HOST，登录跟本次请求的 Host 走。
prepare_docker_env() {
  local compose="${1:-}"
  [[ -f "$ENV_FILE" ]] || return 0
  [[ -n "$compose" && -f "$compose" ]] || die "prepare_docker_env 需要 compose 文件"
  local db_svc uploads_dest assets_dest tmp
  db_svc="$(compose_database_service "$compose")"
  uploads_dest="$(compose_api_mount_dest "$compose" "/uploads:")"
  assets_dest="$(compose_api_mount_dest "$compose" "/app:/")"
  [[ -n "$db_svc" && -n "$uploads_dest" && -n "$assets_dest" ]] || die "无法从 compose 读取数据库服务或挂载路径"
  tmp="$(mktemp)"
  awk -v db="$db_svc" -v uploads="$uploads_dest" -v assets="$assets_dest" '
    /^DATABASE_URL=/ { gsub(/@(127\.0\.0\.1|localhost):5432/, "@" db ":5432") }
    /^RUNTIME=(native|node)$/ { print "RUNTIME=docker"; next }
    /^HOST=127\.0\.0\.1$/ { print "HOST=0.0.0.0"; next }
    /^LOCAL_STORAGE_PATH=\/var\/lib\/z3cz\/storage$/ { print "LOCAL_STORAGE_PATH=" uploads; next }
    /^BOOTSTRAP_ASSETS_DIR=\/opt\/z3cz\// { print "BOOTSTRAP_ASSETS_DIR=" assets; next }
    /^WEB_HOST=https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?\/?$/ { next }
    /^WEBSITE_URL=https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?\/?$/ { next }
    /^WEB_HOST=https?:\/\/([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?\/?$/ { next }
    /^WEBSITE_URL=https?:\/\/([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?\/?$/ { next }
    { print }
  ' "$ENV_FILE" >"$tmp"
  # /app 是只读发布目录。API 在监听前会写启动阶段；写到上传卷上，进程才不会一启动就退出。
  local cache_dir="${uploads_dest}/cache" cache_tmp
  cache_tmp="$(mktemp)"
  awk -v cache="$cache_dir" '
    BEGIN { found = 0 }
    /^API_BOOT_CACHE_DIR=/ {
      found = 1
      value = substr($0, length("API_BOOT_CACHE_DIR=") + 1)
      if (value == "/app" || index(value, "/app/") == 1) {
        print "API_BOOT_CACHE_DIR=" cache
        next
      }
    }
    { print }
    END { if (!found) print "API_BOOT_CACHE_DIR=" cache }
  ' "$tmp" >"$cache_tmp"
  mv "$cache_tmp" "$tmp"
  if [[ -n "${Z3CZ_PUBLIC_URL:-}" ]]; then
    grep -v -E '^(WEB_HOST|WEBSITE_URL)=' "$tmp" >"${tmp}.pub"
    printf 'WEB_HOST=%s\nWEBSITE_URL=%s\n' "$Z3CZ_PUBLIC_URL" "$Z3CZ_PUBLIC_URL" >>"${tmp}.pub"
    mv "${tmp}.pub" "$tmp"
  fi
  if ! cmp -s "$tmp" "$ENV_FILE"; then
    cat "$tmp" >"$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "已将旧的本机配置改为容器网络；未配置域名时不再写入站点地址"
  fi
  rm -f "$tmp"
}

# 后台改域名走 site-address 容器。它和安装写同一份 env，再重建 api 与 caddy。
SITE_SOCKET_DIR="${Z3CZ_SITE_SOCKET_DIR:-/run/z3cz-site}"
SITE_SOCKET="${SITE_SOCKET_DIR}/site.sock"

ensure_site_address_access() {
  [[ -f "$ENV_FILE" ]] || return 0
  local changed=0
  if ! grep -q '^Z3CZ_SITE_ADDRESS_TOKEN=.' "$ENV_FILE"; then
    printf 'Z3CZ_SITE_ADDRESS_TOKEN=%s\n' "$(openssl rand -hex 32)" >>"$ENV_FILE"
    changed=1
  fi
  if ! grep -q '^Z3CZ_SITE_ADDRESS_SOCKET=.' "$ENV_FILE"; then
    printf 'Z3CZ_SITE_ADDRESS_SOCKET=%s\n' "$SITE_SOCKET" >>"$ENV_FILE"
    changed=1
  fi
  if [[ "$changed" == 1 ]]; then
    chmod 600 "$ENV_FILE"
    log "已写入域名服务访问信息"
  fi
}
