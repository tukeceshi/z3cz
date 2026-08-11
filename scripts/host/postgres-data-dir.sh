#!/usr/bin/env bash
# postgres:16-alpine runs as uid/gid 999. An empty bind-mount dir owned by root
# prevents initdb and leaves the container crash-looping (pg_isready never passes).

readonly POSTGRES_CONTAINER_UID=999
readonly POSTGRES_CONTAINER_GID=999

prepare_postgres_data_dir() {
  local dir="${1:?postgres data directory}"
  mkdir -p "$dir"
  if [[ -z "$(ls -A "$dir" 2>/dev/null)" ]]; then
    chown "${POSTGRES_CONTAINER_UID}:${POSTGRES_CONTAINER_GID}" "$dir"
    chmod 700 "$dir"
  fi
}

reset_postgres_data_dir() {
  local dir="${1:?postgres data directory}"
  rm -rf "$dir"
  mkdir -p "$dir"
  chown "${POSTGRES_CONTAINER_UID}:${POSTGRES_CONTAINER_GID}" "$dir"
  chmod 700 "$dir"
}
