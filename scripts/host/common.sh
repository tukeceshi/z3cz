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
