#!/usr/bin/env bash
# Native release updater with database backup and application rollback.
set -euo pipefail
INSTALL_DIR="${DAFTHUNK_INSTALL_DIR:-/opt/z3cz}"
STATE_DIR="${DAFTHUNK_STATE_DIR:-/var/lib/z3cz}"
CONFIG_DIR="${DAFTHUNK_CONFIG_DIR:-/etc/z3cz}"
REPOSITORY="${Z3CZ_UPDATER_REPOSITORY:-tukeceshi/z3cz}"
TARGET="${1:-}"
log() { printf '==> %s\n' "$*"; }
info() { printf ' -> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请使用 sudo 运行"
case "$(uname -m)" in x86_64|amd64) ARCH=amd64;; aarch64|arm64) ARCH=arm64;; *) die "不支持的架构";; esac
if [[ -z "$TARGET" ]]; then
  TARGET="$(curl -fsSL "https://api.github.com/repos/${REPOSITORY}/releases/latest" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi
[[ "$TARGET" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]] || die "无效版本：$TARGET"
ASSET="z3cz-server-linux-${ARCH}.tar.gz"
BASE="https://github.com/${REPOSITORY}/releases/download/${TARGET}"
TMP="$(mktemp --suffix=.tar.gz)"; SUMS="$(mktemp)"
trap 'rm -f "${TMP:-}" "${SUMS:-}"' EXIT
curl -fL --retry 3 "${BASE}/${ASSET}" -o "$TMP"
curl -fL --retry 3 "${BASE}/SHA256SUMS" -o "$SUMS"
EXPECTED="$(awk -v name="$ASSET" '$2 == name {print $1; exit}' "$SUMS")"
ACTUAL="$(sha256sum "$TMP" | awk '{print $1}')"
[[ -n "$EXPECTED" && "$EXPECTED" == "$ACTUAL" ]] || die "部署包校验失败"
NEW_DIR="${INSTALL_DIR}/releases/${TARGET#v}"
OLD_DIR="$(readlink -f "${INSTALL_DIR}/current")"
[[ "$NEW_DIR" != "$OLD_DIR" ]] || { info "已是目标版本 $TARGET"; exit 0; }

log "备份数据库"
mkdir -p "$STATE_DIR/backups" "$STATE_DIR/maintenance"
touch "$STATE_DIR/maintenance/enabled"
BACKUP="${STATE_DIR}/backups/z3cz-before-${TARGET#v}-$(date +%Y%m%d%H%M%S).dump"
set -a
# shellcheck disable=SC1090
source "${CONFIG_DIR}/z3cz.env"
set +a
PGPASSWORD="$(cat "${CONFIG_DIR}/postgres.password")" pg_dump -h 127.0.0.1 -U z3cz --format=custom --file="$BACKUP" z3cz \
  || { rm -f "$STATE_DIR/maintenance/enabled"; die "数据库备份失败"; }

log "安装 $TARGET"
mkdir -p "$NEW_DIR"
tar -xzf "$TMP" -C "$NEW_DIR"
ln -sfn "$NEW_DIR" "${INSTALL_DIR}/current.next"
mv -Tf "${INSTALL_DIR}/current.next" "${INSTALL_DIR}/current"
if bash "${INSTALL_DIR}/current/scripts/host/db-migrate.sh" \
  && systemctl restart z3cz-api.service \
  && bash "${INSTALL_DIR}/current/scripts/host/render-caddy.sh" \
  && systemctl reload caddy \
  && curl --retry 20 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:3001/health >/dev/null; then
  rm -f "$STATE_DIR/maintenance/enabled"
  info "已更新到 $TARGET；备份：$BACKUP"
  exit 0
fi

log "应用启动失败，切回上一版本"
ln -sfn "$OLD_DIR" "${INSTALL_DIR}/current.next"
mv -Tf "${INSTALL_DIR}/current.next" "${INSTALL_DIR}/current"
systemctl restart z3cz-api.service || true
die "更新失败，应用已回退；维护模式仍然开启。数据库如需恢复：pg_restore --clean --if-exists -d z3cz $BACKUP"
