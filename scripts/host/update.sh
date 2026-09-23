#!/usr/bin/env bash
# Formal-release updater. Preparation happens while the current release remains live.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
REPOSITORY="${Z3CZ_REPOSITORY:-tukeceshi/z3cz}"; VERSION="${1:-}"
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || die "更新必须显式指定正式版本，例如 v1.0.9"
ASSET="z3cz-${VERSION}-deploy.tar.gz"; BASE="https://github.com/$REPOSITORY/releases/download/$VERSION"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
log "下载并校验 $VERSION"
curl -fL --retry 3 "$BASE/$ASSET" -o "$TMP/$ASSET"; curl -fL --retry 3 "$BASE/SHA256SUMS" -o "$TMP/SHA256SUMS"
(cd "$TMP" && sha256sum -c SHA256SUMS --ignore-missing) || die "Release SHA-256 校验失败"
TARGET="$INSTALL_DIR/releases/${VERSION#v}"; [[ ! -e "$TARGET" ]] || die "目标版本目录已存在：$TARGET"
mkdir -p "$TARGET"; tar -xzf "$TMP/$ASSET" -C "$TARGET"
[[ "$(tr -d '\r\n' < "$TARGET/VERSION")" == "$VERSION" ]] || die "包内 VERSION 不匹配"
install_prod_dependencies "$TARGET"

CURRENT="$(readlink -f "$INSTALL_DIR/current")"; BACKUP="$STATE_DIR/backups/z3cz-before-${VERSION#v}-$(date +%Y%m%d%H%M%S).dump"
log "进入维护模式并备份数据库"; touch "$STATE_DIR/maintenance/enabled"
"$CURRENT/scripts/backup.sh" "$BACKUP" || { rm -f "$STATE_DIR/maintenance/enabled"; die "备份失败"; }
log "运行新版本迁移"
if ! compose "$TARGET" run --rm --no-deps api node dist/migrate.mjs; then
  die "迁移失败；旧应用仍在运行，维护模式已保留。请检查日志并显式恢复 $BACKUP"
fi

switch_link previous "$CURRENT"; switch_link current "$TARGET"
log "切换并验证新版本"
if compose "$TARGET" up -d --force-recreate --remove-orphans --wait; then
  rm -f "$STATE_DIR/maintenance/enabled"; log "已更新到 $VERSION；备份：$BACKUP"; exit 0
fi

ROLLBACK_COMPATIBLE="$(sed -n 's/.*"rollbackCompatible"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' "$TARGET/update-policy.json" | head -1)"
switch_link current "$CURRENT"
compose "$CURRENT" up -d --force-recreate --remove-orphans || true
if [[ "$ROLLBACK_COMPATIBLE" == true ]]; then
  rm -f "$STATE_DIR/maintenance/enabled"
  die "新应用健康检查失败，已自动回退到旧版本"
fi
die "新应用健康检查失败，代码已切回旧版本；数据库声明为不兼容，维护模式保留。请显式恢复 $BACKUP 后再解除维护模式"
