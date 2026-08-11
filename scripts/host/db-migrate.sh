#!/usr/bin/env bash
# Precheck (per pending migration) + apply Postgres migrations in journal order.
#   sudo bash /var/dafthunk/scripts/host/db-migrate.sh
#
# Optional sidecar next to a migration:
#   0038_foo.sql  +  0038_foo.precheck.sql
# Precheck runs only when that migration is still pending.
set -euo pipefail

INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/var/dafthunk}"
HOST_DIR="${INSTALL_DIR}/docker-host"
# shellcheck source=postgres-data-dir.sh
source "${INSTALL_DIR}/scripts/host/postgres-data-dir.sh"
COMPOSE_FILE="${HOST_DIR}/docker-compose.generated.yml"
ENV_FILE="${HOST_DIR}/.env.generated"
APP_YML="${HOST_DIR}/containers/app.yml"
MIG_DIR="${INSTALL_DIR}/apps/api/src/db/migrations"
JOURNAL="${MIG_DIR}/meta/_journal.json"

log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

psql_q() {
  compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0"
[[ -f "$APP_YML" ]] || die "Missing $APP_YML — run configure.sh first"
[[ -x "${HOST_DIR}/launcher" ]] || die "Missing ${HOST_DIR}/launcher"
[[ -f "$JOURNAL" ]] || die "Missing migration journal: $JOURNAL"
command -v docker >/dev/null 2>&1 || die "docker not found"

log "Ensure compose files"
(cd "$HOST_DIR" && ./launcher render)

[[ -f "$COMPOSE_FILE" ]] || die "Missing $COMPOSE_FILE after render"
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE after render"

prepare_postgres_data_dir "${HOST_DIR}/shared/postgres"

log "Start Postgres"
compose up -d postgres

info "Wait for Postgres healthy"
postgres_ready=0
for _ in $(seq 1 120); do
  if compose exec -T postgres pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    postgres_ready=1
    break
  fi
  sleep 1
done
if [[ "$postgres_ready" -ne 1 ]]; then
  info "Postgres container status:"
  compose ps postgres >&2 || true
  info "Postgres logs (last 80 lines):"
  compose logs postgres --tail 80 >&2 || true
  die "Postgres not ready — check permissions on ${HOST_DIR}/shared/postgres (expected uid ${POSTGRES_CONTAINER_UID})"
fi

# Journal tags in install order (file order matches idx). Drizzle applies the same order.
mapfile -t JOURNAL_TAGS < <(
  grep -oE '"tag": "[^"]+"' "$JOURNAL" | sed 's/"tag": "//;s/"$//'
)

applied_count=0
if psql_q -tAc "SELECT to_regclass('public.__drizzle_migrations') IS NOT NULL;" | grep -qi t; then
  applied_count="$(
    psql_q -tAc "SELECT COUNT(*)::int FROM __drizzle_migrations;" | tr -d '[:space:]'
  )"
fi
applied_count="${applied_count:-0}"

pending_tags=()
i=0
for tag in "${JOURNAL_TAGS[@]}"; do
  if [[ "$i" -ge "$applied_count" ]]; then
    pending_tags+=("$tag")
  fi
  i=$((i + 1))
done

if [[ "${#pending_tags[@]}" -eq 0 ]]; then
  info "No pending migrations"
else
  info "Pending migrations (${#pending_tags[@]}): ${pending_tags[*]}"
fi

log "Run prechecks for pending migrations"
precheck_ran=0
for tag in "${pending_tags[@]+"${pending_tags[@]}"}"; do
  precheck="${MIG_DIR}/${tag}.precheck.sql"
  if [[ ! -f "$precheck" ]]; then
    continue
  fi
  info "Precheck: ${tag}.precheck.sql"
  if ! psql_q -f - <"$precheck"; then
    die "Precheck failed for ${tag} — fix data, then re-run update"
  fi
  precheck_ran=$((precheck_ran + 1))
done
if [[ "$precheck_ran" -eq 0 ]]; then
  info "No precheck files for pending migrations"
else
  info "Prechecks passed (${precheck_ran})"
fi

log "Build api image (includes pending migration SQL)"
compose build api

log "Apply migrations (journal order; only pending)"
compose run --rm --no-deps \
  -e RUN_DB_MIGRATE=true \
  --entrypoint sh \
  api \
  -c 'cd /app/apps/api && pnpm db:migrate'

info "Migrations complete (Drizzle records applied tags in __drizzle_migrations)"
