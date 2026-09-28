#!/usr/bin/env bash
# Failure-path tests: all state lives in a temporary directory; Docker is mocked.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT
export Z3CZ_DEPLOY_TIMEOUT=45
docker() { return 0; }
export -f docker

fixture() {
  local name="$1"
  export Z3CZ_INSTALL_DIR="$TEST_ROOT/$name/install" Z3CZ_STATE_DIR="$TEST_ROOT/$name/state"
  export Z3CZ_CONFIG_DIR="$TEST_ROOT/$name/config" Z3CZ_PNPM_CACHE_DIR="$TEST_ROOT/$name/cache"
  export Z3CZ_UPDATE_DIR="$TEST_ROOT/$name/update" Z3CZ_UPDATER_BIN="$TEST_ROOT/$name/updater"
  export Z3CZ_UPDATER_STATE_DIR="$TEST_ROOT/$name/runner"
  export TEST_LOG="$TEST_ROOT/$name/calls" TEST_FAIL=""
  export Z3CZ_SITE_ADDRESS=:80
  mkdir -p "$Z3CZ_INSTALL_DIR/releases/1.0.0/scripts" "$Z3CZ_STATE_DIR/maintenance" "$Z3CZ_STATE_DIR/backups" "$Z3CZ_CONFIG_DIR" "$Z3CZ_UPDATE_DIR/downloads"
  printf 'old-updater\n' >"$Z3CZ_UPDATER_BIN"
  printf 'test-password\n' >"$Z3CZ_CONFIG_DIR/postgres.password"
  printf 'RUNTIME=docker\nDATABASE_URL=postgresql://z3cz:test-password@postgres:5432/z3cz\nZ3CZ_SITE_ADDRESS_TOKEN=12345678901234567890123456789012\nZ3CZ_SITE_ADDRESS_SOCKET=/run/z3cz-site/site.sock\n' >"$Z3CZ_CONFIG_DIR/z3cz.env"
  local old="$Z3CZ_INSTALL_DIR/releases/1.0.0"
  cp "$ROOT/scripts/host/"{common,update,rollback}.sh "$old/scripts/"
  # Keep production state-machine code intact; substitute external operations.
  cat >>"$old/scripts/common.sh" <<'MOCK'
need_root() { :; }
install_prod_dependencies() { :; }
build_release_image() { printf 'build %s\n' "$1" >>"$TEST_LOG"; }
preflight_deployment() { [[ "$TEST_FAIL" != preflight ]]; }
compose() {
  printf '%s\n' "$*" >>"$TEST_LOG"
  if [[ "$*" == *'up -d --force-recreate'* ]]; then
    [[ "$TEST_FAIL" != both ]] || return 1
    [[ "$TEST_FAIL" != new || "$1" != */1.0.1 ]] || return 1
    [[ "$TEST_FAIL" != install ]] || return 1
  fi
  [[ "$TEST_FAIL" != migration || "$*" != *'dist/migrate.mjs'* ]] || return 1
  [[ "$TEST_FAIL" != database || "$*" != *'exec -T api'* ]] || return 1
  return 0
}
MOCK
  cat >"$old/scripts/backup.sh" <<'BACKUP'
#!/usr/bin/env bash
printf 'database sentinel\n' >"$1"
sha256sum "$1" >"$1.sha256"
BACKUP
  chmod +x "$old/scripts/backup.sh"
  printf 'v1.0.0\n' >"$old/VERSION"
  cp "$ROOT/docker-compose.legacy.yml" "$old/compose.yml"
  ln -s "$old" "$Z3CZ_INSTALL_DIR/current"
  RELEASE="$TEST_ROOT/$name/package"
  mkdir -p "$RELEASE/scripts" "$RELEASE/dist"
  cp "$old/scripts/"{common,update,rollback}.sh "$RELEASE/scripts/"
  cp "$ROOT/scripts/host/install.sh" "$RELEASE/scripts/"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$RELEASE/scripts/install-update-runner.sh"
  cat >"$RELEASE/scripts/install-boot-reconcile.sh" <<'BOOT'
#!/usr/bin/env bash
mkdir -p "${Z3CZ_STATE_DIR:?}/deployment"
printf 'boot-reconcile\n' >>"$Z3CZ_STATE_DIR/deployment/boot-reconcile"
BOOT
  chmod +x "$RELEASE/scripts/install-boot-reconcile.sh" "$RELEASE/scripts/install-update-runner.sh"
  cp "$ROOT/docker-compose.legacy.yml" "$RELEASE/compose.yml"
  printf 'v1.0.1\n' >"$RELEASE/VERSION"
  printf '1\n' >"$RELEASE/password-mount.version"
  for arch in amd64 arm64; do
    printf '#!/usr/bin/env bash\nprintf "true\\n"\n' >"$RELEASE/dist/z3cz-host-updater-linux-$arch"
    chmod +x "$RELEASE/dist/z3cz-host-updater-linux-$arch"
  done
  ARCHIVE="$Z3CZ_UPDATE_DIR/downloads/new.tar.gz"
  tar -czf "$ARCHIVE" -C "$RELEASE" .
  CHECKSUM="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
}

run_update() {
  bash "$Z3CZ_INSTALL_DIR/current/scripts/update.sh" --prepared "$ARCHIVE" "$CHECKSUM" v1.0.1 >"$TEST_ROOT/output" 2>&1
}
expect_failure() {
  if "$@"; then cat "$TEST_ROOT/output"; echo 'Expected failure' >&2; exit 1; fi
}

fixture success
run_update
[[ "$(readlink "$Z3CZ_INSTALL_DIR/current")" == */1.0.1 ]]
[[ ! -e "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
[[ -s "$Z3CZ_UPDATER_STATE_DIR/release-rollback.json" ]]
echo 'PASS: successful update records backup and removes maintenance'

fixture preflight
TEST_FAIL=preflight
expect_failure run_update
[[ "$(readlink "$Z3CZ_INSTALL_DIR/current")" == */1.0.0 ]]
[[ ! -e "$Z3CZ_INSTALL_DIR/releases/1.0.1" ]]
[[ ! -e "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
echo 'PASS: preflight failure leaves the current release serving'

fixture maintenance
touch "$Z3CZ_STATE_DIR/maintenance/enabled"
expect_failure run_update
[[ -f "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
[[ ! -e "$Z3CZ_INSTALL_DIR/releases/1.0.1" ]]
echo 'PASS: an existing maintenance state cannot be cleared by a new update'

fixture new_failure
TEST_FAIL=new
expect_failure run_update
[[ "$(readlink "$Z3CZ_INSTALL_DIR/current")" == */1.0.0 ]]
[[ ! -e "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
grep -q '1.0.0 up -d --force-recreate --remove-orphans --wait' "$TEST_LOG"
grep -q '1.0.0 exec -T api' "$TEST_LOG"
build_line="$(grep -n 'build .*/1.0.0$' "$TEST_LOG" | head -1 | cut -d: -f1)"
up_line="$(grep -n '1.0.0 up -d --force-recreate --remove-orphans --wait' "$TEST_LOG" | head -1 | cut -d: -f1)"
[[ -n "$build_line" && -n "$up_line" && "$build_line" -lt "$up_line" ]]
[[ "$(cat "$Z3CZ_UPDATER_BIN")" == old-updater ]]
echo 'PASS: rollback waits for old release and authenticates database access'

for failure in both database migration; do
  fixture "$failure"
  TEST_FAIL="$failure"
  expect_failure run_update
  [[ -f "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
  [[ -s "$Z3CZ_STATE_DIR/deployment/status" ]]
  echo "PASS: $failure failure preserves maintenance and diagnostics"
done

fixture installation
rm "$Z3CZ_INSTALL_DIR/current"
TEST_FAIL=install
expect_failure bash "$RELEASE/scripts/install.sh"
[[ ! -e "$Z3CZ_INSTALL_DIR/current" ]]
[[ -f "$Z3CZ_STATE_DIR/deployment/install-pending" ]]
TEST_FAIL=""
bash "$RELEASE/scripts/install.sh" >"$TEST_ROOT/output" 2>&1
[[ "$(readlink "$Z3CZ_INSTALL_DIR/current")" == */1.0.1 ]]
[[ ! -e "$Z3CZ_STATE_DIR/deployment/install-pending" ]]
[[ "$(cat "$Z3CZ_CONFIG_DIR/postgres.password")" == test-password ]]
[[ "$(cat "$Z3CZ_CONFIG_DIR/postgres-secret/postgres.password")" == test-password ]]
[[ ! -e "$Z3CZ_STATE_DIR/deployment/boot-reconcile" ]]
echo 'PASS: interrupted installation resumes without replacing password'

for failure in '' both; do
  fixture "rollback-${failure:-success}"
  cp -a "$RELEASE" "$Z3CZ_INSTALL_DIR/releases/1.0.1"
  ln -s "$Z3CZ_INSTALL_DIR/releases/1.0.1" "$Z3CZ_INSTALL_DIR/previous"
  TEST_FAIL="$failure"
  if [[ -z "$failure" ]]; then
    bash "$Z3CZ_INSTALL_DIR/current/scripts/rollback.sh" >"$TEST_ROOT/output" 2>&1
    [[ ! -e "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
  else
    expect_failure bash "$Z3CZ_INSTALL_DIR/current/scripts/rollback.sh"
    [[ -e "$Z3CZ_STATE_DIR/maintenance/enabled" ]]
  fi
done
echo 'PASS: explicit rollback removes maintenance only after health verification'

# Exercise the real compose wrapper, including legacy callers.
source "$ROOT/scripts/host/common.sh"
docker() { printf '%s\n' "$*"; }
output="$(compose /release up -d --wait)"
[[ "$output" == *'--wait --wait-timeout 45' ]]
output="$(compose /release up -d --wait --wait-timeout 12)"
[[ "$output" == *'--wait-timeout 12' && "$output" != *'--wait-timeout 45'* ]]
echo 'PASS: deployment wait is bounded and explicit overrides are preserved'

# New and legacy releases select their own password mount contract.
prepare_release_mounts "$RELEASE"
docker() { printf '%s\n' "$Z3CZ_POSTGRES_PASSWORD_FILE"; }
[[ "$(compose "$RELEASE" config --quiet)" == "$Z3CZ_CONFIG_DIR/postgres-secret" ]]
[[ "$(compose "$Z3CZ_INSTALL_DIR/releases/1.0.0" config --quiet)" == "$Z3CZ_CONFIG_DIR/postgres.password" ]]
echo 'PASS: new directory mount and legacy file mount retain identical credentials'

lock_deployment
if (exec 9>&-; lock_deployment) 2>/dev/null; then
  echo 'Concurrent deployment acquired the same lock' >&2
  exit 1
fi
exec 9>&-
echo 'PASS: concurrent deployments cannot acquire the same lock'

if grep -q '/:/host' "$ROOT/docker-compose.prod.yml"; then
  echo 'runtime compose still mounts the host root' >&2
  exit 1
fi
if ! grep -q '/:/host' "$ROOT/docker-compose.legacy.yml"; then
  echo 'legacy compose must mount / so an old updater can start the release' >&2
  exit 1
fi
if ! grep -q 'compose.runtime.yml' "$ROOT/scripts/host/common.sh"; then
  echo 'compose wrapper does not select compose.runtime.yml' >&2
  exit 1
fi
if grep -q 'Z3CZ_RELEASE_DIR' "$ROOT/docker-compose.prod.yml"; then
  echo 'runtime compose still bind-mounts the release' >&2
  exit 1
fi
if ! grep -q 'Z3CZ_APP_IMAGE' "$ROOT/docker-compose.prod.yml" || ! grep -q 'Z3CZ_WEB_IMAGE' "$ROOT/docker-compose.prod.yml"; then
  echo 'runtime compose does not use the local images' >&2
  exit 1
fi
if ! grep -q 'Z3CZ_RELEASE_DIR' "$ROOT/docker-compose.legacy.yml"; then
  echo 'legacy compose must keep release mounts for an old updater' >&2
  exit 1
fi
if ! grep -q '^ReadWritePaths=.* /etc/z3cz$' "$ROOT/scripts/host/install-update-runner.sh"; then
  echo 'update runner cannot write /etc/z3cz' >&2
  exit 1
fi
runtime_dir="$TEST_ROOT/runtime-release"
mkdir -p "$runtime_dir"
printf 'name: z3cz\n' >"$runtime_dir/compose.yml"
printf 'name: z3cz\n' >"$runtime_dir/compose.runtime.yml"
docker() { printf '%s\n' "$*"; }
runtime_output="$(compose "$runtime_dir" config --quiet)"
[[ "$runtime_output" == *"-f $runtime_dir/compose.runtime.yml"* ]]
[[ "$runtime_output" != *"-f $runtime_dir/compose.yml "* ]]
awk '
  $0 ~ /http:\/\/:8081/ { block=1 }
  block && /reverse_proxy/ { found=1 }
  block && /^}/ { block=0 }
  END { exit found ? 1 : 0 }
' "$ROOT/docker/Caddyfile.prod"
echo 'PASS: caddy liveness does not wait for the API; runtime mounts are narrow and legacy compose keeps /'

boot="$TEST_ROOT/boot"
export Z3CZ_INSTALL_DIR="$boot/install" Z3CZ_STATE_DIR="$boot/state" Z3CZ_CONFIG_DIR="$boot/config"
export Z3CZ_PNPM_CACHE_DIR="$boot/cache" Z3CZ_RECONCILE_COMMON="$ROOT/scripts/host/common.sh"
export Z3CZ_RECONCILE_WAIT=5
mkdir -p "$Z3CZ_INSTALL_DIR/releases/boot" "$Z3CZ_STATE_DIR/postgres" "$Z3CZ_STATE_DIR/deployment" "$Z3CZ_CONFIG_DIR"
printf 'name: z3cz\n' >"$Z3CZ_INSTALL_DIR/releases/boot/compose.yml"
ln -sfn "$Z3CZ_INSTALL_DIR/releases/boot" "$Z3CZ_INSTALL_DIR/current"
printf 'pw\n' >"$Z3CZ_CONFIG_DIR/postgres.password"
printf 'NODE_ENV=production\n' >"$Z3CZ_CONFIG_DIR/z3cz.env"
docker() { return 0; }
# shellcheck disable=SC1091
source "$ROOT/scripts/host/reconcile.sh"
wait_for_mounts
compose() { printf '%s\n' "$*" >"$boot/up"; }
reconcile_main
[[ "$(cat "$boot/up")" == *'up -d --wait'* ]]
[[ "$(cat "$boot/up")" != *'force-recreate'* ]]
docker() { return 1; }
export Z3CZ_RECONCILE_WAIT=0
if wait_for_mounts; then
  echo 'reconcile waited successfully while docker was down' >&2
  exit 1
fi
echo 'PASS: boot reconcile waits for docker and starts without recreating containers'
bash "$ROOT/scripts/host/boot-reconcile.test.sh"
bash "$ROOT/scripts/host/bootstrap.test.sh"

image_release="$TEST_ROOT/image-release"
mkdir -p "$image_release/api" "$image_release/app" "$image_release/caddy" "$image_release/scripts"
printf 'v1.2.3\n' >"$image_release/VERSION"
printf 'name: z3cz\n' >"$image_release/compose.runtime.yml"
printf 'ok\n' >"$image_release/caddy/Caddyfile"
printf 'node\n' >"$image_release/scripts/site-address-server.mjs"
docker() { cat >/dev/null; printf '%s\n' "$*" >>"$TEST_ROOT/builds"; }
build_release_image "$image_release"
grep -q -- '-t z3cz:1.2.3' "$TEST_ROOT/builds"
grep -q -- '-t z3cz-web:1.2.3' "$TEST_ROOT/builds"
echo 'PASS: a runtime release is copied into local app and web images'

lib_root="$TEST_ROOT/docker-libs"
mkdir -p "$lib_root/real" "$lib_root/stage" "$lib_root/bin"
printf 'linker\n' >"$lib_root/real/ld-linux-x86-64.so.2"
printf 'libc\n' >"$lib_root/real/libc-2.36.so"
ln -s "libc-2.36.so" "$lib_root/real/libc.so.6"
printf 'padding /lib64/ld-linux-x86-64.so.2 end\n' >"$lib_root/bin/fake-docker"
[[ "$(library_stage_rel /lib64/ld-linux-x86-64.so.2)" == ld-linux-x86-64.so.2 ]]
[[ "$(library_stage_rel /lib/x86_64-linux-gnu/ld-linux-x86-64.so.2)" == x86_64-linux-gnu/ld-linux-x86-64.so.2 ]]
[[ "$(library_stage_rel /usr/lib/x86_64-linux-gnu/libc.so.6)" == x86_64-linux-gnu/libc.so.6 ]]
[[ "$(elf_interpreter "$lib_root/bin/fake-docker")" == /lib64/ld-linux-x86-64.so.2 ]]
install_real_library "$lib_root/real/libc.so.6" "$lib_root/stage"
[[ ! -L "$lib_root/stage/libc.so.6" ]]
[[ "$(cat "$lib_root/stage/libc.so.6")" == libc ]]
ldd() {
  printf '\tlibc.so.6 => %s (0x1)\n' "$lib_root/real/libc.so.6"
}
mkdir -p "$lib_root/stage2"
copy_dynamic_libs "$lib_root/bin/fake-docker" "$lib_root/stage2"
[[ -f "$lib_root/stage2/libc.so.6" && ! -L "$lib_root/stage2/libc.so.6" ]]
[[ "$(cat "$lib_root/stage2/libc.so.6")" == libc ]]
unset -f ldd
echo 'PASS: staged docker libraries are real files, not broken links'

ok_home="$TEST_ROOT/ok-home"
blocked_home="$TEST_ROOT/not-a-directory"
mkdir -p "$ok_home"
printf 'x\n' >"$blocked_home"
saved_home="${HOME:-}"
saved_config="${DOCKER_CONFIG-unset}"
HOME="$ok_home"
unset DOCKER_CONFIG
ensure_docker_cli_home
[[ -d "$ok_home/.docker" ]]
[[ -z "${DOCKER_CONFIG:-}" ]]
HOME="$blocked_home"
unset DOCKER_CONFIG
ensure_docker_cli_home
[[ "$HOME" == "$STATE_DIR/docker-home" ]]
[[ "$DOCKER_CONFIG" == "$STATE_DIR/docker-home/.docker" ]]
[[ -d "$DOCKER_CONFIG" ]]
if [[ "$saved_config" == unset ]]; then unset DOCKER_CONFIG; else DOCKER_CONFIG="$saved_config"; fi
HOME="$saved_home"
echo 'PASS: docker config moves off an unwritable home'
