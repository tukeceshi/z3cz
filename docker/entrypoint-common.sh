# Shared Docker entrypoint helpers (sourced by entrypoint*.sh).
# Scheme I 配套：lock 哈希写在各服务自己的 /app/node_modules 卷内，避免并行竞态误跳过。
# Scheme II：nodes 源文件哈希未变则跳过 extract-nodes。
# Scheme IV：pnpm-lock.yaml 哈希未变且依赖完整则跳过 pnpm install。

dafthunk_ensure_dev_vars() {
  if [ ! -f apps/api/.dev.vars ]; then
    echo "[entrypoint] 未找到 apps/api/.dev.vars，已从示例文件创建。"
    echo "[entrypoint] 非密钥项可编辑该文件；登录 OAuth 请在 Admin → 登录方式配置；JWT/MASTER 由 API 写入 /data/secrets/.dev.vars。"
    cp apps/api/.dev.vars.example apps/api/.dev.vars
  fi
}

# 按 DAFTHUNK_SERVICE 检查本服务所需依赖是否齐全（多容器各自独立卷）
dafthunk_deps_look_complete() {
  if [ ! -d node_modules/.pnpm ] || [ ! -f node_modules/.modules.yaml ]; then
    return 1
  fi

  case "${DAFTHUNK_SERVICE:-monolith}" in
    api)
      if [ ! -x node_modules/.bin/tsx ] || [ ! -x node_modules/.bin/drizzle-kit ]; then
        return 1
      fi
      if [ ! -e apps/api/node_modules/.bin/tsx ]; then
        return 1
      fi
      ;;
    www)
      if [ ! -x node_modules/.bin/tsx ]; then
        return 1
      fi
      if [ ! -d apps/www/node_modules ]; then
        return 1
      fi
      ;;
    app)
      if [ ! -d apps/app/node_modules ]; then
        return 1
      fi
      ;;
    monolith|*)
      if [ ! -x node_modules/.bin/tsx ] || [ ! -x node_modules/.bin/drizzle-kit ]; then
        return 1
      fi
      if [ ! -e apps/api/node_modules/.bin/tsx ]; then
        return 1
      fi
      ;;
  esac

  return 0
}

dafthunk_is_interactive_dev_server() {
  case "$*" in
    *dev:docker*|*dev:docker:api*) return 0 ;;
    *@dafthunk/www*dev*) return 0 ;;
    *@dafthunk/app*dev*) return 0 ;;
  esac
  return 1
}

# 方案 IV：lockfile 哈希缓存在本服务 root node_modules 卷内
dafthunk_conditional_install() {
  if [ "${SKIP_INSTALL:-0}" = "1" ]; then
    echo "[entrypoint] SKIP_INSTALL=1，跳过依赖安装。"
    return 0
  fi

  if ! dafthunk_is_interactive_dev_server "$@"; then
    echo "[entrypoint] 非 dev server 命令，跳过 pnpm install。"
    return 0
  fi

  if [ ! -f pnpm-lock.yaml ]; then
    echo "[entrypoint] 未找到 pnpm-lock.yaml，跳过依赖安装。"
    return 0
  fi

  mkdir -p node_modules
  LOCK_HASH_FILE="node_modules/.dafthunk-lock-hash"
  LOCK_HASH="$(sha256sum pnpm-lock.yaml | awk '{print $1}')"

  if [ "${FORCE_PNPM_INSTALL:-0}" != "1" ] \
    && [ -f "$LOCK_HASH_FILE" ] \
    && [ "$(cat "$LOCK_HASH_FILE")" = "$LOCK_HASH" ] \
    && dafthunk_deps_look_complete; then
    echo "[entrypoint] 依赖已是最新（lock 未变），跳过 pnpm install。"
    return 0
  fi

  if [ "${FORCE_PNPM_INSTALL:-0}" = "1" ]; then
    echo "[entrypoint] FORCE_PNPM_INSTALL=1，强制重新安装..."
  elif [ -f "$LOCK_HASH_FILE" ] && [ "$(cat "$LOCK_HASH_FILE")" = "$LOCK_HASH" ]; then
    echo "[entrypoint] lockfile 未变但依赖不完整，重新安装..."
  else
    echo "[entrypoint] 正在安装/同步依赖..."
  fi

  pnpm install --frozen-lockfile
  echo "$LOCK_HASH" > "$LOCK_HASH_FILE"
}

dafthunk_patch_dev_vars() {
  if ! grep -q '^DATABASE_URL=' apps/api/.dev.vars 2>/dev/null; then
    echo "DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@supabase-db:5432/postgres}" >> apps/api/.dev.vars
  fi

  if [ -f /.dockerenv ] || [ "${CI:-}" = "true" ]; then
    sed -i \
      -e 's|postgresql://postgres:postgres@localhost:5432/postgres|postgresql://postgres:postgres@supabase-db:5432/postgres|g' \
      -e 's|postgresql://postgres:postgres@127.0.0.1:5432/postgres|postgresql://postgres:postgres@supabase-db:5432/postgres|g' \
      -e 's|\.comDATABASE_URL=|\.com\nDATABASE_URL=|g' \
      apps/api/.dev.vars 2>/dev/null || true
  fi

  if [ -f /.dockerenv ] || [ "${CI:-}" = "true" ]; then
    sed -i \
      -e 's|^LOCAL_STORAGE_PATH=.*|LOCAL_STORAGE_PATH=/app/data/storage|g' \
      -e 's|^LOCAL_STORAGE_PATH=d:PORT=.*|LOCAL_STORAGE_PATH=/app/data/storage|g' \
      apps/api/.dev.vars 2>/dev/null || true
  fi

  if ! grep -q '^LOCAL_STORAGE_PATH=' apps/api/.dev.vars 2>/dev/null; then
    echo "LOCAL_STORAGE_PATH=/app/data/storage" >> apps/api/.dev.vars
  fi

  if ! grep -q '^PORT=' apps/api/.dev.vars 2>/dev/null; then
    echo "PORT=3102" >> apps/api/.dev.vars
  fi
}

# 方案 II：仅当节点源或 extract 脚本变化时重跑 extract-nodes
dafthunk_nodes_source_hash() {
  find packages/runtime/src/nodes apps/www/scripts \
    \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' -type f -print0 2>/dev/null \
    | sort -z \
    | xargs -0 sha256sum 2>/dev/null \
    | sha256sum \
    | awk '{print $1}'
}

dafthunk_maybe_extract_nodes() {
  if [ "${SKIP_EXTRACT_NODES:-0}" = "1" ]; then
    return 0
  fi

  NODES_JSON="apps/www/data/nodes.json"
  NODES_HASH_FILE="apps/www/data/.nodes-source-hash"
  mkdir -p apps/www/data

  CURRENT_HASH="$(dafthunk_nodes_source_hash)"

  if [ -f "$NODES_JSON" ] && [ -f "$NODES_HASH_FILE" ] && [ "$(cat "$NODES_HASH_FILE")" = "$CURRENT_HASH" ]; then
    echo "[entrypoint] nodes 源未变，跳过 extract-nodes。"
    return 0
  fi

  echo "[entrypoint] 正在生成 apps/www/data/nodes.json..."
  pnpm --filter '@dafthunk/www' extract-nodes
  echo "$CURRENT_HASH" > "$NODES_HASH_FILE"
}

dafthunk_strip_duplicate_secret_keys() {
  if [ ! -f /.dockerenv ]; then
    return 0
  fi

  local secrets_file="${SECRETS_FILE:-/data/secrets/.dev.vars}"
  if [ ! -f "$secrets_file" ] || [ ! -f apps/api/.dev.vars ]; then
    return 0
  fi

  if grep -q '^SECRET_MASTER_KEY=' apps/api/.dev.vars 2>/dev/null \
    || grep -q '^JWT_SECRET=' apps/api/.dev.vars 2>/dev/null; then
    echo "[entrypoint] Docker K1 已启用：从 apps/api/.dev.vars 移除 JWT_SECRET / SECRET_MASTER_KEY。"
    sed -i '/^SECRET_MASTER_KEY=/d; /^JWT_SECRET=/d' apps/api/.dev.vars 2>/dev/null || true
  fi
}

dafthunk_entrypoint_init() {
  dafthunk_ensure_dev_vars
  dafthunk_strip_duplicate_secret_keys
  dafthunk_conditional_install "$@"
  dafthunk_patch_dev_vars
  dafthunk_maybe_extract_nodes
}

dafthunk_apply_api_restart_mode() {
  CACHE_DIR="${API_BOOT_CACHE_DIR:-/app/data/storage/cache}"
  mkdir -p "$CACHE_DIR"

  if [ -f "$CACHE_DIR/restart-mode.full" ]; then
    echo "[entrypoint] API restart mode: full (install + migrate + warm)"
    export SKIP_INSTALL=0
    export FORCE_PNPM_INSTALL=1
    export FORCE_DB_MIGRATE=1
    export RUN_RUNTIME_WARMUP=1
    export RUN_WASM_WARMUP=1
    rm -f "$CACHE_DIR/restart-mode.full"
    return 0
  fi

  if [ -f "$CACHE_DIR/restart-mode.warm" ]; then
    echo "[entrypoint] API restart mode: warm (runtime preload)"
    export SKIP_DB_MIGRATE=1
    export RUN_RUNTIME_WARMUP=1
    export RUN_WASM_WARMUP=1
    rm -f "$CACHE_DIR/restart-mode.warm"
    return 0
  fi

  if [ -f "$CACHE_DIR/restart-mode.fast" ]; then
    echo "[entrypoint] API restart mode: fast (skip migrate when stamp matches)"
    export SKIP_DB_MIGRATE=1
    rm -f "$CACHE_DIR/restart-mode.fast"
    return 0
  fi
}
