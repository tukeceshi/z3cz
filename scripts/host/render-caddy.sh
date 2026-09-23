#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/opt/z3cz}"
STATE_DIR="${DAFTHUNK_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${DAFTHUNK_CONFIG_DIR:-/etc/z3cz}"
HOSTNAME="$(cat "${CONFIG_DIR}/hostname" 2>/dev/null || true)"
SITE="${HOSTNAME:-:80}"
cat >/etc/caddy/Caddyfile <<EOF
{
	servers {
		protocols h1 h2
	}
}

${SITE} {
	encode gzip zstd
	root * ${INSTALL_DIR}/current/app
	@maintenance file {
		root ${STATE_DIR}/maintenance
		try_files enabled
	}
	respond @maintenance "系统正在更新，请稍后刷新。" 503
	handle_path /api/* {
		reverse_proxy 127.0.0.1:3001
	}
	handle {
		try_files {path} /index.html
		file_server
	}
}
EOF
caddy validate --config /etc/caddy/Caddyfile
