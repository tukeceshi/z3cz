#!/usr/bin/env bash
# Formal-release updater. Preparation happens while the current release remains live.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
REPOSITORY="${Z3CZ_REPOSITORY:-tukeceshi/z3cz}"; PREPARED_ARCHIVE=""; PREPARED_CHECKSUM=""
if [[ "${1:-}" == "--prepared" ]]; then
  PREPARED_ARCHIVE="${2:-}"; PREPARED_CHECKSUM="${3:-}"; VERSION="${4:-}"
else
  VERSION="${1:-}"
fi
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || die "更新必须显式指定正式版本，例如 v1.0.9"
ASSET="z3cz-${VERSION}-deploy.tar.gz"; BASE="https://github.com/$REPOSITORY/releases/download/$VERSION"
TMP="$(mktemp -d)"; TARGET_CREATED=0; MAINTENANCE_STARTED=0
cleanup() {
  local status=$?
  rm -rf "$TMP"
  if [[ "$status" -ne 0 && "$TARGET_CREATED" == 1 && "$MAINTENANCE_STARTED" == 0 ]]; then
    rm -rf "$TARGET"
  fi
}
trap cleanup EXIT
if [[ -n "$PREPARED_ARCHIVE" ]]; then
  UPDATE_ROOT="${Z3CZ_UPDATE_DIR:-/var/lib/z3cz/update}/downloads"
  case "$(readlink -f "$PREPARED_ARCHIVE")" in "$UPDATE_ROOT"/*) ;; *) die "预备更新包不在允许目录" ;; esac
  [[ -f "$PREPARED_ARCHIVE" && "$PREPARED_CHECKSUM" =~ ^[a-f0-9]{64}$ ]] || die "预备更新包参数无效"
  log "复核后台已下载的 $VERSION"
  [[ "$(sha256sum "$PREPARED_ARCHIVE" | awk '{print $1}')" == "$PREPARED_CHECKSUM" ]] || die "预备更新包 SHA-256 不匹配"
  cp "$PREPARED_ARCHIVE" "$TMP/$ASSET"
else
  log "下载并校验 $VERSION"
  curl -fL --retry 3 "$BASE/$ASSET" -o "$TMP/$ASSET"; curl -fL --retry 3 "$BASE/SHA256SUMS" -o "$TMP/SHA256SUMS"
  (cd "$TMP" && sha256sum -c SHA256SUMS --ignore-missing) || die "Release SHA-256 校验失败"
fi
TARGET="$INSTALL_DIR/releases/${VERSION#v}"; [[ ! -e "$TARGET" ]] || die "目标版本目录已存在：$TARGET"
STAGED="$TMP/release"; mkdir -p "$STAGED"; tar -xzf "$TMP/$ASSET" -C "$STAGED"
[[ "$(tr -d '\r\n' < "$STAGED/VERSION")" == "$VERSION" ]] || die "包内 VERSION 不匹配"
CURRENT="$(readlink -f "$INSTALL_DIR/current")"
CURRENT_VERSION="$(tr -d '\r\n' < "$CURRENT/VERSION")"
case "$(uname -m)" in x86_64|amd64) UPDATER_ARCH=amd64 ;; aarch64|arm64) UPDATER_ARCH=arm64 ;; *) die "不支持的 CPU 架构" ;; esac
POLICY_CHECKER="$STAGED/dist/z3cz-host-updater-linux-$UPDATER_ARCH"
[[ -x "$POLICY_CHECKER" ]] || die "发布包缺少更新执行器"
ROLLBACK_COMPATIBLE="$("$POLICY_CHECKER" validate-policy "$STAGED" "$CURRENT_VERSION")" || die "更新策略检查失败"
WRITE_PROBE="$(mktemp /usr/local/bin/.z3cz-update-runner.XXXXXX)" || die "更新执行器无法写入 /usr/local/bin"
rm -f "$WRITE_PROBE"
mv "$STAGED" "$TARGET"
TARGET_CREATED=1
install -m 0755 "$TARGET/dist/z3cz-host-updater-linux-$UPDATER_ARCH" /usr/local/bin/z3cz-update-runner
install_prod_dependencies "$TARGET"

BACKUP="$STATE_DIR/backups/z3cz-before-${VERSION#v}-$(date +%Y%m%d%H%M%S).dump"
log "进入维护模式并备份数据库"; touch "$STATE_DIR/maintenance/enabled"
MAINTENANCE_STARTED=1
"$CURRENT/scripts/backup.sh" "$BACKUP" || { rm -f "$STATE_DIR/maintenance/enabled"; die "备份失败"; }
log "运行新版本迁移"
prepare_docker_env "$TARGET/compose.yml"
ensure_site_address_access
if ! compose "$TARGET" run --rm --no-deps api node dist/migrate.mjs; then
  die "迁移失败；旧应用仍在运行，维护模式已保留。请检查日志并显式恢复 $BACKUP"
fi

switch_link previous "$CURRENT"; switch_link current "$TARGET"
log "切换并验证新版本"
if compose "$TARGET" up -d --force-recreate --remove-orphans --wait; then
  rm -f "$STATE_DIR/maintenance/enabled"; log "已更新到 $VERSION；备份：$BACKUP"; exit 0
fi

switch_link current "$CURRENT"
compose "$CURRENT" up -d --force-recreate --remove-orphans || true
if [[ "$ROLLBACK_COMPATIBLE" == true ]]; then
  rm -f "$STATE_DIR/maintenance/enabled"
  die "新应用健康检查失败，已自动回退到旧版本"
fi
die "新应用健康检查失败，代码已切回旧版本；数据库声明为不兼容，维护模式保留。请显式恢复 $BACKUP 后再解除维护模式"
