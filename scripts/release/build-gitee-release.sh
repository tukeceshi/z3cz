#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

version="$(tr -d '\r\n' < VERSION)"
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || {
  echo "VERSION is not a release version: $version" >&2
  exit 1
}
grep -Fqx "## $version" CHANGELOG.md || {
  echo "CHANGELOG.md is missing ## $version" >&2
  exit 1
}

node scripts/host/validate-update-policy.mjs
bash scripts/host/pack-deploy.sh

asset="dist/deploy/z3cz-${version}-deploy.tar.gz"
[[ -f "$asset" && -f dist/deploy/SHA256SUMS ]] || {
  echo "Deploy package or checksum is missing" >&2
  exit 1
}

awk -v heading="## $version" '
  $0 == heading { found=1; next }
  found && /^## / { exit }
  found { print }
' CHANGELOG.md > RELEASE_NOTES.md
test -s RELEASE_NOTES.md || printf 'z3cz %s\n' "$version" > RELEASE_NOTES.md

if [[ "$version" == *-* ]]; then
  prerelease=true
else
  prerelease=false
fi
# Gitee Go reads this file to pass the tag into the Release plugin.
if [[ -f GITEE_PARAMS ]]; then
  grep -vE '^(RELEASE_TAG|RELEASE_PRERELEASE)=' GITEE_PARAMS > GITEE_PARAMS.tmp
  mv GITEE_PARAMS.tmp GITEE_PARAMS
fi
printf 'RELEASE_TAG=%s\nRELEASE_PRERELEASE=%s\n' "$version" "$prerelease" >> GITEE_PARAMS

echo "Gitee release assets for $version are ready at $(git rev-parse HEAD)"
