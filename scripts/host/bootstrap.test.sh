#!/usr/bin/env bash
# Docker is installed before a release download. External commands are mocked.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT
unset -f docker curl systemctl uname command 2>/dev/null || true
# shellcheck disable=SC1091
source "$ROOT/scripts/host/bootstrap.sh"
need_root() { :; }

assert_fail() {
  local label="$1"
  shift
  if ("$@") >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"; then
    echo "$label: expected failure" >&2
    exit 1
  fi
}

run_case() {
  local name="$1"
  BIN="$TEST_ROOT/$name"
  LOG="$TEST_ROOT/$name.log"
  mkdir -p "$BIN"
  rm -f "$BIN/docker-ready"
  : >"$LOG"
}

mark_docker_ready() { : >"$BIN/docker-ready"; }

docker() {
  [[ -f "$BIN/docker-ready" ]] || return 1
  case "${1:-}" in
    compose) [[ "${2:-}" == version ]] ;;
    info) return 0 ;;
    *) return 1 ;;
  esac
}
uname() { printf '%s\n' "${FAKE_UNAME:-Linux}"; }
install_curl() {
  printf 'curl %s\n' "$*" >>"$LOG"
  case "$*" in
    *get.docker.com*) mark_docker_ready ;;
    *) echo "unexpected curl: $*" >&2; return 1 ;;
  esac
}
curl() { install_curl "$@"; }
systemctl() { printf 'systemctl %s\n' "$*" >>"$LOG"; }

run_case present
FAKE_UNAME=Linux
mark_docker_ready
ensure_docker >"$TEST_ROOT/present.out"
grep -q '已检测到 Docker' "$TEST_ROOT/present.out"
[[ ! -s "$LOG" ]]

run_case missing
FAKE_UNAME=Linux
ensure_docker >"$TEST_ROOT/missing.out"
grep -q 'Docker 已安装' "$TEST_ROOT/missing.out"
grep -q 'get.docker.com' "$LOG"
grep -q 'systemctl enable --now docker' "$LOG"

run_case broken
FAKE_UNAME=Linux
curl() { printf 'curl %s\n' "$*" >>"$LOG"; }
assert_fail 'install leaves docker missing' ensure_docker
grep -q 'Docker 安装后仍不可用' "$TEST_ROOT/err"

run_case other-os
FAKE_UNAME=Darwin
assert_fail 'non-linux' ensure_docker
grep -q '一键安装仅支持 Linux' "$TEST_ROOT/err"

run_case no-curl
FAKE_UNAME=Linux
unset -f curl
command() {
  if [[ "${1:-}" == -v && "${2:-}" == curl ]]; then
    return 1
  fi
  builtin command "$@"
}
assert_fail 'missing curl' ensure_docker
grep -q '需要 curl' "$TEST_ROOT/err"

echo 'PASS: bootstrap installs Docker before downloading a release'
