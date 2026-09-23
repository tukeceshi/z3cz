#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/opt/z3cz}"
CONFIG_DIR="${DAFTHUNK_CONFIG_DIR:-/etc/z3cz}"
ENV_FILE="${CONFIG_DIR}/z3cz.env"
[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "请使用 sudo 运行" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "缺少 $ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
cd "${INSTALL_DIR}/current/api/apps/api"
exec "${INSTALL_DIR}/current/node/bin/node" node_modules/drizzle-kit/bin.cjs migrate
