#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/scripts/release/gitee-auth.sh"

TARGET_SHA="${1:?target commit is required}"
TAG="${2:-}"
git cat-file -e "${TARGET_SHA}^{commit}"
TARGET_COMMIT="$(git rev-parse "${TARGET_SHA}^{commit}")"

remote_main="$(git ls-remote "$GITEE_REPOSITORY_URL" refs/heads/main | awk '{print $1}')"
if [[ -n "$remote_main" && "$remote_main" != "$TARGET_COMMIT" ]]; then
  git fetch --no-tags "$GITEE_REPOSITORY_URL" "+refs/heads/main:refs/remotes/gitee/main"
  git merge-base --is-ancestor "$remote_main" "$TARGET_COMMIT" || {
    echo "Gitee main has diverged; refusing to overwrite it" >&2
    exit 1
  }
fi
if [[ "$remote_main" != "$TARGET_COMMIT" ]]; then
  git push "$GITEE_REPOSITORY_URL" "$TARGET_COMMIT:refs/heads/main"
else
  echo "Gitee main is already synchronized"
fi

if [[ -n "$TAG" ]]; then
  local_tag_sha="$(git rev-list -n 1 "$TAG")"
  [[ "$local_tag_sha" == "$TARGET_COMMIT" ]] || {
    echo "$TAG does not point to $TARGET_COMMIT" >&2
    exit 1
  }
  remote_tag_sha="$(git ls-remote "$GITEE_REPOSITORY_URL" "refs/tags/$TAG" "refs/tags/$TAG^{}" | tail -1 | awk '{print $1}')"
  if [[ -n "$remote_tag_sha" && "$remote_tag_sha" != "$local_tag_sha" ]]; then
    echo "Gitee tag $TAG already exists at another commit; refusing to overwrite it" >&2
    exit 1
  fi
  if [[ -z "$remote_tag_sha" ]]; then
    git push "$GITEE_REPOSITORY_URL" "refs/tags/$TAG:refs/tags/$TAG"
  else
    echo "Gitee tag $TAG is already synchronized"
  fi
fi
