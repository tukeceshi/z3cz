#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${Z3CZ_INSTALL_DIR:-/opt/z3cz}"; STATE_DIR="${Z3CZ_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${Z3CZ_CONFIG_DIR:-/etc/z3cz}"; CACHE_DIR="${Z3CZ_PNPM_CACHE_DIR:-/var/cache/z3cz/pnpm}"
ENV_FILE="$CONFIG_DIR/z3cz.env"
die() { echo "ERROR: $*" >&2; exit 1; }; log() { echo "==> $*"; }
need_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"; }
compose() {
  Z3CZ_RELEASE_DIR="$1" Z3CZ_ENV_FILE="$ENV_FILE" \
    Z3CZ_POSTGRES_PASSWORD_FILE="$CONFIG_DIR/postgres.password" \
    docker compose --env-file "$ENV_FILE" -f "$1/compose.yml" "${@:2}"
}
install_prod_dependencies() {
  local release="$1"; mkdir -p "$CACHE_DIR"
  docker run --rm \
    -v "$release/api:/app" -v "$CACHE_DIR:/pnpm/store" -w /app \
    node:22.12.0-bookworm-slim@sha256:35531c52ce27b6575d69755c73e65d4468dba93a25644eed56dc12879cae9213 \
    sh -ec 'npm install --global pnpm@10.3.0; pnpm config set store-dir /pnpm/store; pnpm install --prod --frozen-lockfile --config.auto-install-peers=false'
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
