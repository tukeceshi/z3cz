#!/usr/bin/env bash
# Install a published release. Formal upgrades use /opt/z3cz/current/scripts/update.sh vX.Y.Z.
set -euo pipefail
REPOSITORY="${Z3CZ_REPOSITORY:-tukeceshi/z3cz}"
[[ "$REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "仓库名称无效" >&2; exit 1; }

if [[ -n "${Z3CZ_INSTALL_VERSION:-}" ]]; then
  VERSION="$Z3CZ_INSTALL_VERSION"
else
  LATEST_URL="$(curl -fLsS --retry 3 -o /dev/null -w '%{url_effective}' "https://github.com/$REPOSITORY/releases/latest")"
  VERSION="${LATEST_URL##*/}"
fi
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "正式版本号无效：$VERSION" >&2; exit 1; }

BASE="https://github.com/$REPOSITORY/releases/download/$VERSION"
ASSET="z3cz-${VERSION}-deploy.tar.gz"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fL --retry 3 "$BASE/SHA256SUMS" -o "$TMP/SHA256SUMS"
CHECKSUM="$(awk -v asset="$ASSET" '$2 == asset && length($1) == 64 && $1 ~ /^[a-fA-F0-9]+$/ {print $1}' "$TMP/SHA256SUMS")"
[[ "$CHECKSUM" =~ ^[a-fA-F0-9]{64}$ ]] || { echo "找不到部署包的 SHA-256 校验值" >&2; exit 1; }
curl -fL --retry 3 "$BASE/$ASSET" -o "$TMP/$ASSET"
(cd "$TMP" && printf '%s  %s\n' "$CHECKSUM" "$ASSET" | sha256sum -c -)
mkdir "$TMP/release"; tar -xzf "$TMP/$ASSET" -C "$TMP/release"
[[ "$(tr -d '\r\n' < "$TMP/release/VERSION")" == "$VERSION" ]] || { echo "部署包版本不匹配" >&2; exit 1; }
bash "$TMP/release/scripts/install.sh"
