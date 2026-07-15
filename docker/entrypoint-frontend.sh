#!/bin/sh
set -e

. /usr/local/bin/entrypoint-common.sh

dafthunk_wait_for_api_if_needed() {
  if [ -z "${API_PROXY_TARGET:-}" ]; then
    return 0
  fi

  HEALTH_URL="${API_PROXY_TARGET%/}/health"
  TIMEOUT_SEC="${API_WAIT_TIMEOUT_SEC:-480}"
  echo "[entrypoint] Waiting for API at ${HEALTH_URL} before starting app..."

  STARTED_AT=$(date +%s)
  while true; do
    if node -e "fetch('${HEALTH_URL}').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      echo "[entrypoint] API is ready."
      return 0
    fi

    NOW=$(date +%s)
    ELAPSED=$((NOW - STARTED_AT))
    if [ "$ELAPSED" -ge "$TIMEOUT_SEC" ]; then
      echo "[entrypoint] Timed out waiting for API after ${TIMEOUT_SEC}s."
      return 1
    fi

    if [ $((ELAPSED % 30)) -eq 0 ] && [ "$ELAPSED" -gt 0 ]; then
      echo "[entrypoint] Still waiting for API (${ELAPSED}s elapsed)..."
    fi

    sleep 2
  done
}

cd /app
dafthunk_entrypoint_init "$@"
dafthunk_wait_for_api_if_needed

exec "$@"
