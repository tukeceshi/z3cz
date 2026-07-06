#!/bin/sh
set -e

cd /app

if [ ! -f apps/api/.dev.vars ]; then
  echo "[entrypoint] 未找到 apps/api/.dev.vars，已从示例文件创建。"
  echo "[entrypoint] 请编辑该文件填入 JWT_SECRET、SECRET_MASTER_KEY 等配置后重启容器。"
  cp apps/api/.dev.vars.example apps/api/.dev.vars
fi

if [ ! -d node_modules/.pnpm ]; then
  echo "[entrypoint] 正在安装依赖..."
  pnpm install --frozen-lockfile
fi

if [ "${RUN_DB_MIGRATE:-true}" = "true" ]; then
  echo "[entrypoint] 正在应用本地 D1 数据库迁移..."
  pnpm --filter '@dafthunk/api' db:migrate || true
fi

exec "$@"
