#!/usr/bin/env bash
# Install the boot reconciler. Linux uses systemd; Docker Desktop/WSL uses a logon task.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh"

LIB_DIR=/usr/local/lib/z3cz
UNIT=/etc/systemd/system/z3cz-compose.service

# Production Linux is the docker.service path, including a WSL distro that
# installed Docker Engine. The kernel string is not a WSL signal: containers
# see the host kernel, and sudo clears WSL_DISTRO_NAME. Userspace that a
# server does not have (/run/WSL, or wslpath plus a Windows drive) selects
# the Desktop logon task. Z3CZ_WSL_RUN_DIR and Z3CZ_WSL_WINDOWS_DIR let tests
# simulate that layout.

docker_service_present() {
  command -v systemctl >/dev/null 2>&1 && systemctl cat docker.service >/dev/null 2>&1
}

wsl_windows_mounted() {
  local dir=""
  if [[ -n "${Z3CZ_WSL_WINDOWS_DIR+x}" ]]; then
    dir="$Z3CZ_WSL_WINDOWS_DIR"
    if [[ -n "$dir" && -d "$dir" ]]; then
      return 0
    fi
    return 1
  fi
  if [[ -d /mnt/c/Windows || -d /mnt/c/WINDOWS ]]; then
    return 0
  fi
  return 1
}

wsl_userspace_present() {
  if [[ -d "${Z3CZ_WSL_RUN_DIR:-/run/WSL}" ]]; then
    return 0
  fi
  if command -v wslpath >/dev/null 2>&1 && wsl_windows_mounted; then
    return 0
  fi
  return 1
}

classify_boot_backend() {
  local docker_service="$1" wsl_userspace="$2"
  if [[ "$docker_service" == 1 ]]; then
    printf 'systemd\n'
    return 0
  fi
  if [[ "$wsl_userspace" == 1 ]]; then
    printf 'wsl\n'
    return 0
  fi
  printf 'manual\n'
}

boot_reconcile_backend() {
  local docker=0 wsl=0
  if [[ -n "${Z3CZ_BOOT_RECONCILE_BACKEND:-}" ]]; then
    printf '%s\n' "$Z3CZ_BOOT_RECONCILE_BACKEND"
    return 0
  fi
  if docker_service_present; then
    docker=1
  fi
  if wsl_userspace_present; then
    wsl=1
  fi
  classify_boot_backend "$docker" "$wsl"
}

valid_distro_name() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._\ -]{0,80}$ ]]
}

read_ancestor_distro() {
  local pid="$PPID" depth=0 name="" next=""
  while (( depth < 8 )); do
    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    (( pid > 1 )) || return 1
    if [[ -r "/proc/$pid/environ" ]]; then
      name="$(tr '\0' '\n' < "/proc/$pid/environ" | sed -n 's/^WSL_DISTRO_NAME=//p' | head -n 1 || true)"
      if [[ -n "$name" ]]; then
        printf '%s\n' "$name"
        return 0
      fi
    fi
    next="$(awk '/^PPid:/{print $2}' "/proc/$pid/status" 2>/dev/null || true)"
    [[ -n "$next" && "$next" != "$pid" ]] || return 1
    pid="$next"
    depth=$((depth + 1))
  done
  return 1
}

distro_from_unc() {
  local win="$1"
  [[ "$win" =~ ^\\\\wsl(\.localhost|\$)\\([^\\]+) ]] || return 1
  printf '%s\n' "${BASH_REMATCH[2]}"
}

distro_from_wslpath() {
  local win=""
  command -v wslpath >/dev/null 2>&1 || return 1
  win="$(wslpath -w / 2>/dev/null || true)"
  [[ -n "$win" ]] || return 1
  distro_from_unc "$win"
}

resolve_wsl_distro_name() {
  local name=""
  if [[ -n "${WSL_DISTRO_NAME:-}" ]] && valid_distro_name "$WSL_DISTRO_NAME"; then
    printf '%s\n' "$WSL_DISTRO_NAME"
    return 0
  fi
  if name="$(read_ancestor_distro)" && valid_distro_name "$name"; then
    printf '%s\n' "$name"
    return 0
  fi
  if name="$(distro_from_wslpath)" && valid_distro_name "$name"; then
    printf '%s\n' "$name"
    return 0
  fi
  return 1
}

resolve_powershell() {
  local candidate="" root
  for root in /mnt/c/Windows /mnt/c/WINDOWS; do
    candidate="$root/System32/WindowsPowerShell/v1.0/powershell.exe"
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  candidate="$(command -v powershell.exe 2>/dev/null || true)"
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi
  return 1
}

install_reconcile_scripts() {
  install -d -m 0755 "$LIB_DIR"
  install -m 0755 "$HERE/reconcile.sh" "$LIB_DIR/reconcile.sh"
  install -m 0755 "$HERE/reconcile-stop.sh" "$LIB_DIR/reconcile-stop.sh"
}

install_systemd_unit() {
  # Do not enable docker.service. The engine is started separately; this unit
  # only orders after it and reconciles once mounts exist.
  cat >"$UNIT" <<EOF
[Unit]
Description=Start z3cz when Docker and its data directories are ready
After=docker.service network-online.target
Wants=network-online.target

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
  local ps="" script win distro
  distro="$(resolve_wsl_distro_name)" || die "已检测到 WSL，但无法确定发行版名称。请重新执行：sudo --preserve-env=WSL_DISTRO_NAME bash $0"
  ps="$(resolve_powershell)" || die "WSL 中找不到 powershell.exe，无法注册开机任务"
  script="$HERE/windows-boot-task.ps1"
  [[ -f "$script" ]] || die "缺少 $script"
  win="$(wslpath -w "$script")" || die "无法把开机任务脚本转换成 Windows 路径"
  "$ps" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$win" -Distro "$distro" \
    || die "注册 Windows 开机任务失败"
  log "已注册 Windows 登录任务 z3cz-compose（$distro）"
}

main() {
  need_root
  install_reconcile_scripts
  case "$(boot_reconcile_backend)" in
    systemd) install_systemd_unit ;;
    wsl) install_wsl_tasks ;;
    manual)
      log "未检测到 docker.service 或 WSL。请在 Docker 就绪后执行：$LIB_DIR/reconcile.sh"
      ;;
    *) die "未知开机编排后端：$(boot_reconcile_backend)" ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main
fi
