#!/usr/bin/env bash
set -euo pipefail
: "${GITEE_ACCESS_TOKEN:?GITEE_ACCESS_TOKEN is required}"
TAG="${1:?release tag is required}"
NOTES="${2:?release notes path is required}"
shift 2
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || { echo "Invalid release tag" >&2; exit 1; }
[[ -f "$NOTES" && "$#" -gt 0 ]] || { echo "Release notes or assets are missing" >&2; exit 1; }

API="https://gitee.com/api/v5/repos/daotuke/z3cz"
AUTH=( -H "Authorization: Bearer $GITEE_ACCESS_TOKEN" )
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

status="$(curl -sS -o "$tmp/release.json" -w '%{http_code}' "${AUTH[@]}" "$API/releases/tags/$TAG")"
if [[ "$status" == 404 ]]; then
  curl -fsS "${AUTH[@]}" -X POST "$API/releases" \
    --data-urlencode "tag_name=$TAG" \
    --data-urlencode "name=$TAG" \
    --data-urlencode "target_commitish=main" \
    --data-urlencode "body@$NOTES" >"$tmp/release.json"
elif [[ "$status" != 200 ]]; then
  echo "Gitee release lookup returned HTTP $status" >&2
  cat "$tmp/release.json" >&2
  exit 1
fi
release_id="$(jq -er '.id' "$tmp/release.json")"

curl -fsS "${AUTH[@]}" "$API/releases/$release_id/attach_files" >"$tmp/assets.json"
for asset in "$@"; do
  [[ -f "$asset" ]] || { echo "Missing asset: $asset" >&2; exit 1; }
  name="$(basename "$asset")"
  local_sha="$(sha256sum "$asset" | awk '{print $1}')"
  attachment_id="$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' "$tmp/assets.json" | head -1)"
  if [[ -n "$attachment_id" ]]; then
    curl -fsSL "${AUTH[@]}" "$API/releases/$release_id/attach_files/$attachment_id/download" -o "$tmp/$name"
    remote_sha="$(sha256sum "$tmp/$name" | awk '{print $1}')"
    [[ "$remote_sha" == "$local_sha" ]] || {
      echo "Gitee attachment $name exists with a different SHA-256; refusing to overwrite it" >&2
      exit 1
    }
    echo "Gitee attachment $name is already synchronized"
    continue
  fi
  curl -fsS "${AUTH[@]}" -X POST "$API/releases/$release_id/attach_files" \
    -F "file=@$asset" >"$tmp/upload.json"
  attachment_id="$(jq -er '.id' "$tmp/upload.json")"
  curl -fsSL "${AUTH[@]}" "$API/releases/$release_id/attach_files/$attachment_id/download" -o "$tmp/$name"
  [[ "$(sha256sum "$tmp/$name" | awk '{print $1}')" == "$local_sha" ]] || {
    echo "Gitee attachment verification failed: $name" >&2
    exit 1
  }
  echo "Uploaded and verified Gitee attachment $name"
done

