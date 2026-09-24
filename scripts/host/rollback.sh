#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; source "$HERE/common.sh"; need_root
RESTORE=""
if [[ "${1:-}" == "--restore" ]]; then
  RESTORE="${2:-}"
  [[ -f "$RESTORE" ]] || die "缺少回退备份"
  if [[ -f "$RESTORE.sha256" ]]; then
    sha256sum -c "$RESTORE.sha256" || die "备份校验失败"
  fi
fi
PREVIOUS="$(readlink -f "$INSTALL_DIR/previous")"
[[ -d "$PREVIOUS" ]] || die "没有可回退版本"
CURRENT="$(readlink -f "$INSTALL_DIR/current")"
[[ "$PREVIOUS" != "$CURRENT" ]] || die "没有可回退版本"
log "进入维护模式并回退"
touch "$STATE_DIR/maintenance/enabled"
if [[ -n "$RESTORE" ]]; then
  log "恢复更新前数据库备份"
  compose "$CURRENT" stop api caddy || true
  compose "$CURRENT" up -d --wait postgres
  compose "$CURRENT" exec -T postgres pg_restore -U z3cz -d z3cz --clean --if-exists --no-owner --no-privileges --exit-on-error < "$RESTORE"
fi
switch_link previous "$CURRENT"
switch_link current "$PREVIOUS"
if ! compose "$PREVIOUS" up -d --force-recreate --wait; then
  die "回退启动失败，维护模式已保留"
fi
rm -f "$STATE_DIR/maintenance/enabled"
log "应用已回退到 $(tr -d '\r\n' < "$PREVIOUS/VERSION")"
