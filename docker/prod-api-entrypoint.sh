#!/bin/sh
set -e

cd /app/apps/api

if [ "${RUN_DB_MIGRATE:-true}" = "true" ]; then
  echo "[prod-api] Applying Postgres migrations..."
  pnpm db:migrate
fi

exec "$@"
