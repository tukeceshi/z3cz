#!/usr/bin/env bash
# First-install channel only. Formal upgrades use /opt/z3cz/current/scripts/update.sh vX.Y.Z.
set -euo pipefail
REPOSITORY="${Z3CZ_REPOSITORY:-tukeceshi/z3cz}"; CHANNEL="${Z3CZ_INSTALL_CHANNEL:-self-host}"
BASE="https://github.com/$REPOSITORY/releases/download/$CHANNEL"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fL --retry 3 "$BASE/SHA256SUMS" -o "$TMP/SHA256SUMS"
ASSET="$(awk 'NF == 2 && $2 ~ /^z3cz-v.*-deploy\.tar\.gz$/ {print $2; exit}' "$TMP/SHA256SUMS")"
[[ -n "$ASSET" ]] || { echo "找不到安装包" >&2; exit 1; }
curl -fL --retry 3 "$BASE/$ASSET" -o "$TMP/$ASSET"
(cd "$TMP" && sha256sum -c SHA256SUMS --ignore-missing)
mkdir "$TMP/release"; tar -xzf "$TMP/$ASSET" -C "$TMP/release"
bash "$TMP/release/scripts/install.sh"
