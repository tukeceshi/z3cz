#!/usr/bin/env bash
# Real release smoke test in a disposable Docker daemon. Never mounts the host
# Docker socket or application data, and never publishes ports on the host.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="${1:-$ROOT/dist/release}"
[[ -f "$RELEASE/api/dist/server.mjs" && -f "$RELEASE/caddy/Caddyfile" ]] || { echo 'Build the release first' >&2; exit 1; }
NAME="z3cz-release-test-$$-$(date +%s)"
TMP="$(mktemp -d)"
cleanup() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    docker exec "$NAME" sh -c 'docker ps -a --format "{{.Names}} {{.Status}}"' || true
    # Do not print full inspect/config output: both can contain credentials.
  fi
  docker rm -fv "$NAME" >/dev/null 2>&1 || true
  docker image rm "$NAME-host" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
docker build -q -t "$NAME-host" -f "$ROOT/scripts/release/Dockerfile.smoke" "$ROOT/scripts/release" >/dev/null
docker run -d --privileged --name "$NAME" --label z3cz.test=release "$NAME-host" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$NAME" docker info >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$NAME" docker info >/dev/null
if [[ "${Z3CZ_TEST_SEED_IMAGES:-0}" == 1 ]]; then
  for image in node:22.12.0-bookworm-slim postgres:16.6-alpine caddy:2.9.1-alpine; do
    if docker image inspect "$image" >/dev/null 2>&1; then
      docker image save "$image" | docker exec -i "$NAME" docker image load >/dev/null
    fi
  done
fi
docker cp "$RELEASE" "$NAME:/input"
docker exec "$NAME" env Z3CZ_SITE_ADDRESS=:80 bash /input/scripts/install.sh

cat >"$TMP/check.sh" <<'CHECK'
#!/usr/bin/env bash
set -euo pipefail
source /opt/z3cz/current/scripts/common.sh
release="$(readlink -f /opt/z3cz/current)"
compose "$release" ps --format '{{.Service}} {{.Health}}'
for service in postgres site-address api caddy; do
  id="$(compose "$release" ps -q "$service")"
  [[ -n "$id" && "$(docker inspect --format '{{.State.Health.Status}}' "$id")" == healthy ]]
done
verify_database_access "$release"
compose "$release" exec -T api node -e "fetch('http://caddy/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CHECK
docker cp "$TMP/check.sh" "$NAME:/check.sh"
docker exec "$NAME" bash /check.sh

# Check DB reconnection and maintenance-independent health using real services.
docker exec "$NAME" bash -ec '
  source /opt/z3cz/current/scripts/common.sh
  release=$(readlink -f /opt/z3cz/current)
  compose "$release" exec -T postgres psql -U z3cz -d z3cz -c "CREATE TABLE deployment_sentinel (id integer PRIMARY KEY); INSERT INTO deployment_sentinel VALUES (42);"
  api=$(compose "$release" ps -q api)
  compose "$release" stop postgres
  compose "$release" exec -T api node -e "fetch(\"http://127.0.0.1:3001/health/ready\").then(r=>process.exit(r.status===503?0:1)).catch(()=>process.exit(1))"
  compose "$release" up -d postgres --wait
  compose "$release" start --wait api caddy
  test "$api" = "$(compose "$release" ps -q api)"
  touch /var/lib/z3cz/maintenance/enabled
  compose "$release" exec -T caddy wget -q -T 3 -O /dev/null http://127.0.0.1:8081/health
  rm /var/lib/z3cz/maintenance/enabled
'

# Restart this disposable daemon only; do not run compose up to mask recovery.
docker restart -t 90 "$NAME" >/dev/null
for attempt in $(seq 1 90); do
  if docker exec "$NAME" bash /check.sh >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$NAME" bash /check.sh
docker exec "$NAME" bash -ec '
  source /opt/z3cz/current/scripts/common.sh
  test "$(compose /opt/z3cz/current exec -T postgres psql -U z3cz -d z3cz -Atc "SELECT id FROM deployment_sentinel")" = 42
'

# Upgrade through an unmodified legacy entrypoint when provided by CI.
if [[ -n "${Z3CZ_TEST_LEGACY_REF:-}" ]]; then
  mkdir -p "$TMP/legacy"
  for script in common.sh update.sh; do
    git -C "$ROOT" show "$Z3CZ_TEST_LEGACY_REF:scripts/host/$script" >"$TMP/legacy/$script"
  done
  docker cp "$TMP/legacy" "$NAME:/legacy"
  docker exec "$NAME" sh -ec 'cp /legacy/*.sh /opt/z3cz/current/scripts/'
fi
docker exec "$NAME" bash -ec '
  mkdir -p /var/lib/z3cz/update/downloads
  printf "v99.0.0\n" >/input/VERSION
  tar -czf /var/lib/z3cz/update/downloads/test.tar.gz -C /input .
  sum=$(sha256sum /var/lib/z3cz/update/downloads/test.tar.gz | cut -d" " -f1)
  bash /opt/z3cz/current/scripts/update.sh --prepared /var/lib/z3cz/update/downloads/test.tar.gz "$sum" v99.0.0
'
docker exec "$NAME" bash /check.sh

# Bad new entrypoint must trigger verified rollback and retain database data.
docker exec "$NAME" bash -ec '
  printf "v99.0.1\n" >/input/VERSION
  printf "process.exit(1);\n" >/input/api/dist/server.mjs
  tar -czf /var/lib/z3cz/update/downloads/bad.tar.gz -C /input .
  sum=$(sha256sum /var/lib/z3cz/update/downloads/bad.tar.gz | cut -d" " -f1)
  if Z3CZ_DEPLOY_TIMEOUT=60 bash /opt/z3cz/current/scripts/update.sh --prepared /var/lib/z3cz/update/downloads/bad.tar.gz "$sum" v99.0.1; then exit 1; fi
  test "$(cat /opt/z3cz/current/VERSION)" = v99.0.0
  test ! -e /var/lib/z3cz/maintenance/enabled
  source /opt/z3cz/current/scripts/common.sh
  test "$(compose /opt/z3cz/current exec -T postgres psql -U z3cz -d z3cz -Atc "SELECT id FROM deployment_sentinel")" = 42
'
docker exec "$NAME" bash /check.sh
echo 'PASS: real release install, reconnect, maintenance, daemon restart, upgrade and rollback'
