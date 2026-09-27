#!/usr/bin/env bash
# Install the boot reconciler. Linux uses systemd; Docker Desktop/WSL uses a logon task.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh"
need_root

LIB_DIR=/usr/local/lib/z3cz
UNIT=/etc/systemd/system/z3cz-compose.service

boot_reconcile_backend() {
  if [[ -n "${Z3CZ_BOOT_RECONCILE_BACKEND:-}" ]]; then
    printf '%s\n' "$Z3CZ_BOOT_RECONCILE_BACKEND"
    return 0
  fi
  if command -v systemctl >/dev/null 2>&1 && systemctl cat docker.service >/dev/null 2>&1; then
    printf 'systemd\n'
    return 0
  fi
  if [[ -n "${WSL_DISTRO_NAME:-}" ]] && [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
    printf 'wsl\n'
    return 0
  fi
  printf 'manual\n'
}

install_reconcile_scripts() {
  install -d -m 0755 "$LIB_DIR"
  install -m 0755 "$HERE/reconcile.sh" "$LIB_DIR/reconcile.sh"
  install -m 0755 "$HERE/reconcile-stop.sh" "$LIB_DIR/reconcile-stop.sh"
}

install_systemd_unit() {
  systemctl enable docker.service
  cat >"$UNIT" <<EOF
[Unit]
Description=Start z3cz when Docker and its data directories are ready
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$LIB_DIR/reconcile.sh
ExecStop=$LIB_DIR/reconcile-stop.sh
TimeoutStartSec=600
TimeoutStopSec=90

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable z3cz-compose.service
  log "已启用开机编排 z3cz-compose.service"
}

install_wsl_tasks() {
  local ps script win
  [[ "$WSL_DISTRO_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._\ -]{0,80}$ ]] || die "WSL 发行版名称无法用于计划任务：$WSL_DISTRO_NAME"
  ps="$(command -v powershell.exe || true)"
  [[ -n "$ps" ]] || die "WSL 中找不到 powershell.exe，无法注册开机任务"
  script="$HERE/windows-boot-task.ps1"
  [[ -f "$script" ]] || die "缺少 $script"
  win="$(wslpath -w "$script")"
  "$ps" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$win" -Distro "$WSL_DISTRO_NAME" \
    || die "注册 Windows 开机任务失败"
  log "已注册 Windows 登录任务 z3cz-compose（$WSL_DISTRO_NAME）"
}

install_reconcile_scripts
case "$(boot_reconcile_backend)" in
  systemd) install_systemd_unit ;;
  wsl) install_wsl_tasks ;;
  manual)
    log "未检测到 docker.service 或 WSL。请在 Docker 就绪后执行：$LIB_DIR/reconcile.sh"
    ;;
  *) die "未知开机编排后端：$(boot_reconcile_backend)" ;;
esac
