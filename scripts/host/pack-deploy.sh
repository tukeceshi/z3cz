#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="$ROOT/dist/release"; OUT="${Z3CZ_OUT_DIR:-$ROOT/dist/deploy}"
VERSION="$(tr -d '\r\n' < "$ROOT/VERSION")"
rm -rf "$STAGE"; mkdir -p "$STAGE/api" "$STAGE/app" "$STAGE/scripts" "$OUT"
VITE_API_HOST=/api VITE_WS_VIA_PROXY=1 pnpm --filter @dafthunk/app build:docker-prod
pnpm --filter @dafthunk/api build:production
cp -R "$ROOT/apps/app/dist/." "$STAGE/app/"
cp "$ROOT/deploy/api/package.json" "$ROOT/deploy/api/pnpm-lock.yaml" "$STAGE/api/"
cp "$ROOT/docker-compose.prod.yml" "$STAGE/compose.yml"
cp "$ROOT/docker/Caddyfile.prod" "$STAGE/Caddyfile"
cp "$ROOT/scripts/host/common.sh" "$ROOT/scripts/host/install.sh" "$ROOT/scripts/host/update.sh" "$ROOT/scripts/host/backup.sh" "$ROOT/scripts/host/rollback.sh" "$STAGE/scripts/"
cp "$ROOT/VERSION" "$ROOT/CHANGELOG.md" "$ROOT/update-policy.json" "$STAGE/"
chmod +x "$STAGE/scripts/"*.sh
node "$ROOT/scripts/release/verify-release.mjs" "$STAGE"
asset="z3cz-${VERSION}-deploy.tar.gz"
tar -czf "$OUT/$asset" -C "$STAGE" .
(cd "$OUT" && sha256sum "$asset" > SHA256SUMS)
echo "Created $OUT/$asset"
