#!/bin/sh
set -e

. /usr/local/bin/entrypoint-common.sh

cd /app
dafthunk_entrypoint_init "$@"

exec "$@"
