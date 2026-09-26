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
  cp "$ROOT/docker-compose.prod.yml" "$old/compose.yml"
  ln -s "$old" "$Z3CZ_INSTALL_DIR/current"
  RELEASE="$TEST_ROOT/$name/package"
  mkdir -p "$RELEASE/scripts" "$RELEASE/dist"
  cp "$old/scripts/"{common,update,rollback}.sh "$RELEASE/scripts/"
  cp "$ROOT/scripts/host/install.sh" "$RELEASE/scripts/"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$RELEASE/scripts/install-update-runner.sh"
  cp "$ROOT/docker-compose.prod.yml" "$RELEASE/compose.yml"
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
