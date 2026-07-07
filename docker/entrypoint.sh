#!/bin/sh
set -e

cd /app

if [ ! -f apps/api/.dev.vars ]; then
  echo "[entrypoint] 未找到 apps/api/.dev.vars，已从示例文件创建。"
  echo "[entrypoint] 请运行 generate-master-key.js 生成 JWT_SECRET 与 SECRET_MASTER_KEY 后重启容器。"
  cp apps/api/.dev.vars.example apps/api/.dev.vars
fi

echo "[entrypoint] 正在安装/同步依赖..."
pnpm install --no-frozen-lockfile

if [ "${RUN_DB_MIGRATE:-true}" = "true" ]; then
  echo "[entrypoint] 正在应用 Postgres 数据库迁移..."
  DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@supabase-db:5432/postgres}" \
    pnpm --filter '@dafthunk/api' db:migrate
fi

if ! grep -q '^DATABASE_URL=' apps/api/.dev.vars 2>/dev/null; then
  echo "DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@supabase-db:5432/postgres}" >> apps/api/.dev.vars
fi

# Docker 内 localhost 无法访问 Postgres 容器，统一改为 compose 服务名
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

if [ ! -f apps/www/data/nodes.json ]; then
  echo "[entrypoint] 正在生成 apps/www/data/nodes.json..."
  pnpm --filter '@dafthunk/www' extract-nodes
fi

exec "$@"
