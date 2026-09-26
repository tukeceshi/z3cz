#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${Z3CZ_INSTALL_DIR:-/opt/z3cz}"; STATE_DIR="${Z3CZ_UPDATE_DIR:-/var/lib/z3cz/update}"
SOCKET_DIR="${Z3CZ_UPDATER_SOCKET_DIR:-/run/z3cz-updater}"; CONFIG_DIR="${Z3CZ_CONFIG_DIR:-/etc/z3cz}"
ENV_FILE="$CONFIG_DIR/z3cz.env"; BIN="/usr/local/bin/z3cz-update-runner"
[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "请使用 sudo 运行" >&2; exit 1; }
command -v systemctl >/dev/null || { echo "需要 systemd" >&2; exit 1; }
case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) echo "不支持的 CPU 架构" >&2; exit 1 ;; esac
source_bin="$INSTALL_DIR/current/dist/z3cz-host-updater-linux-$arch"
[[ -f "$source_bin" ]] || { echo "缺少更新执行器：$source_bin" >&2; exit 1; }
install -m 0755 "$source_bin" "$BIN"; install -d -m 0700 "$STATE_DIR" "$STATE_DIR/downloads"; install -d -m 0755 "$SOCKET_DIR"
token="$(sed -n 's/^UPDATER_TOKEN=//p' "$ENV_FILE" | head -1)"
if [[ ${#token} -lt 32 ]]; then
  token="$(openssl rand -hex 32)"
  printf '\nUPDATER_TOKEN=%s\nUPDATER_SOCKET=%s/updater.sock\nZ3CZ_UPDATE_DIR=%s\n' "$token" "$SOCKET_DIR" "$STATE_DIR" >>"$ENV_FILE"
fi
printf 'Z3CZ_UPDATER_TOKEN=%s\nZ3CZ_INSTALL_DIR=%s\nZ3CZ_UPDATER_SOCKET=%s/updater.sock\nZ3CZ_UPDATER_STATE_DIR=%s/runner\nZ3CZ_UPDATE_DIR=%s\n' "$token" "$INSTALL_DIR" "$SOCKET_DIR" "$STATE_DIR" "$STATE_DIR" >/etc/z3cz-update-runner.env
chmod 600 /etc/z3cz-update-runner.env "$ENV_FILE"
cat >/etc/systemd/system/z3cz-update-runner.service <<EOF
[Unit]
Description=z3cz update runner
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=simple
EnvironmentFile=/etc/z3cz-update-runner.env
ExecStart=$BIN serve
Restart=on-failure
RestartSec=5s
RuntimeDirectory=z3cz-updater
RuntimeDirectoryMode=0755
RuntimeDirectoryPreserve=yes
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=$INSTALL_DIR /var/lib/z3cz $STATE_DIR $SOCKET_DIR /var/cache/z3cz /usr/local/bin
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now z3cz-update-runner.service; systemctl restart z3cz-update-runner.service
echo "更新执行器已安装：$SOCKET_DIR/updater.sock"
