#!/bin/sh
set -e

. /usr/local/bin/entrypoint-common.sh

dafthunk_apply_api_restart_mode

cd /app
dafthunk_entrypoint_init "$@"

if [ "$RUN_WASM_WARMUP" = "1" ]; then
  echo "[entrypoint] Running WASM runtime warmup..."
  node apps/api/scripts/warm-api-runtime.mjs
fi

exec "$@"
