#!/usr/bin/env bash
# Boot-backend selection. Docker Engine on Linux stays on systemd even when a
# WSL directory is visible. A host with neither docker.service nor WSL
# userspace stays manual.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT
# shellcheck disable=SC1091
source "$ROOT/scripts/host/install-boot-reconcile.sh"

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" != "$want" ]]; then
    printf '%s: got [%s] want [%s]\n' "$label" "$got" "$want" >&2
    exit 1
  fi
}

assert_eq "$(classify_boot_backend 1 0)" systemd "docker.service is systemd"
assert_eq "$(classify_boot_backend 1 1)" systemd "docker.service wins over WSL userspace"
assert_eq "$(classify_boot_backend 0 1)" wsl "WSL userspace without docker.service"
assert_eq "$(classify_boot_backend 0 0)" manual "Linux without docker.service stays manual"

mkdir -p "$TEST_ROOT/wsl-run" "$TEST_ROOT/windows"
(
  export Z3CZ_WSL_RUN_DIR="$TEST_ROOT/absent-run" Z3CZ_WSL_WINDOWS_DIR="$TEST_ROOT/absent-windows"
  unset Z3CZ_BOOT_RECONCILE_BACKEND
  systemctl() { return 1; }
  assert_eq "$(boot_reconcile_backend)" manual "probe: no unit and no WSL userspace"
)
(
  export Z3CZ_WSL_RUN_DIR="$TEST_ROOT/wsl-run" Z3CZ_WSL_WINDOWS_DIR="$TEST_ROOT/absent-windows"
  unset Z3CZ_BOOT_RECONCILE_BACKEND WSL_DISTRO_NAME
  systemctl() { return 1; }
  assert_eq "$(boot_reconcile_backend)" wsl "probe: /run/WSL survives a cleared distro name"
)
(
  export Z3CZ_WSL_RUN_DIR="$TEST_ROOT/wsl-run" Z3CZ_WSL_WINDOWS_DIR="$TEST_ROOT/windows"
  unset Z3CZ_BOOT_RECONCILE_BACKEND
  systemctl() { [[ "${1:-}" == cat && "${2:-}" == docker.service ]]; }
  assert_eq "$(boot_reconcile_backend)" systemd "probe: docker.service is not overridden on a WSL layout"
)
(
  export Z3CZ_WSL_RUN_DIR="$TEST_ROOT/absent-run" Z3CZ_WSL_WINDOWS_DIR="$TEST_ROOT/windows"
  unset Z3CZ_BOOT_RECONCILE_BACKEND
  systemctl() { return 1; }
  wslpath() { return 0; }
  assert_eq "$(boot_reconcile_backend)" wsl "probe: wslpath plus a Windows drive"
)
(
  export Z3CZ_BOOT_RECONCILE_BACKEND=manual
  export Z3CZ_WSL_RUN_DIR="$TEST_ROOT/wsl-run"
  systemctl() { [[ "${1:-}" == cat && "${2:-}" == docker.service ]]; }
  assert_eq "$(boot_reconcile_backend)" manual "explicit backend override"
)

assert_eq "$(distro_from_unc '\\wsl.localhost\Ubuntu\')" Ubuntu "wsl.localhost UNC"
assert_eq "$(distro_from_unc '\\wsl$\Debian\')" Debian "wsl$ UNC"
assert_eq "$(distro_from_unc '\\wsl.localhost\Ubuntu 22.04\')" "Ubuntu 22.04" "distro name with a space"
if distro_from_unc 'C:\Windows'; then
  echo "a Windows drive path was parsed as a distro" >&2
  exit 1
fi

(
  export WSL_DISTRO_NAME=Debian-Test
  assert_eq "$(resolve_wsl_distro_name)" Debian-Test "env distro is used as given"
)
(
  export WSL_DISTRO_NAME='///'
  if name="$(resolve_wsl_distro_name)"; then
    [[ "$name" != '///' ]]
  fi
)

ps1="$ROOT/scripts/host/windows-boot-task.ps1"
grep -q -- '-d $Distro -u root --' "$ps1"
if grep -F -q -- '-d `"$Distro`"' "$ps1"; then
  echo 'wsl.exe treats quotes as part of the distribution name' >&2
  exit 1
fi
grep -q -- '-AtLogOn -User' "$ps1"
grep -q -- '-RunLevel Limited' "$ps1"
grep -q -- '<UserId>USER_ID</UserId>' "$ps1"
if grep -q -- '-AtLogOn$' "$ps1"; then
  echo 'logon trigger must name the current user so a non-admin can register it' >&2
  exit 1
fi
echo "PASS: boot reconcile keeps Linux on systemd and detects WSL without its env var"
