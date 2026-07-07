# Docker 开发与自托管

使用 Docker 运行完整开发栈，或在单机以容器构建方式运行实验性生产栈。本地默认 **Node API + Postgres + 本地文件存储**，无需在宿主机安装 Node.js。

## 更新说明

| 日期 | 说明 |
|------|------|
| 2026-07-07 | **Cloudflare → Node 本地/自托管迁移**：API 改为 `@hono/node-server`；数据库改为 Postgres；对象存储改为本地 FS；Durable Object / Queue / 持久化工作流等改为进程内实现；入站邮件改为 HTTP webhook + SMTP 网关；新增 `docker-compose.prod.yml`（www Node SSR + app + API + SMTP）。 |
| 2026-07-06 | 修复 Node 启动问题（`setNodeBindings` 导入）；生产 compose 与 `pnpm prod:up` 脚本。 |
| 2026-07-05 | 初始 Docker 开发编排（`supabase-db` + 三端口 dev 容器）。 |

## 前置要求

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2
- Git
- Cloudflare 账号（可选，仅 AI / 远程 preview 等功能需要）

## 开发模式

### 1. 初始化

```bash
cp .env.docker.example .env.docker
cp apps/api/.dev.vars.example apps/api/.dev.vars
docker compose run --rm -e RUN_DB_MIGRATE=false dev node apps/api/scripts/generate-master-key.js
```

将输出的 `JWT_SECRET`、`SECRET_MASTER_KEY` 写入 `apps/api/.dev.vars`，并确认：

```env
WEB_HOST=http://localhost:3101
WEBSITE_URL=http://localhost:3100
DATABASE_URL=postgresql://postgres:postgres@supabase-db:5432/postgres
```

### 2. 启动

```bash
docker compose --env-file .env.docker up -d
```

容器会自动：启动 Postgres → 同步依赖 → 执行数据库迁移 → 并行启动 www / app / api。

> API 首次启动约需 **2–3 分钟**（WASM 初始化），看到日志 `[api] Node server listening` 后即可访问。

### 3. 访问地址

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站 `@dafthunk/www` |
| http://localhost:3101 | 产品应用 `@dafthunk/app` |
| http://localhost:3102 | API `@dafthunk/api`（Node + Hono） |
| localhost:5432 | Postgres（用户/密码/库均为 `postgres`） |

### 4. 常用命令

```bash
# 前台启动
docker compose --env-file .env.docker up --build

# 停止
docker compose down

# 查看日志
docker compose --env-file .env.docker logs -f dev

# 容器内测试 / 迁移
docker compose run --rm dev pnpm test
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:migrate
```

OAuth 回调地址均为 `http://localhost:3102/...`；未配置 OAuth 时可使用登录页 **测试账户**。详见 `apps/api/.dev.vars.example`。

## 实验性生产栈（容器内构建）

单机自托管：`Postgres + Node API + www（SSR）+ app（Nginx）+ SMTP 网关`。

```bash
pnpm prod:env          # 从 .dev.vars 同步密钥到 .env.docker.prod
pnpm prod:up           # 构建并启动
pnpm prod:up -- --no-build   # 仅重启
pnpm prod:down         # 停止
```

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站（Node SSR） |
| http://localhost:3101 | 产品 app（Nginx + `/api` 反代） |
| http://localhost:3102 | API |
| localhost:2525 | SMTP → `/inbound-email/raw` |

> 生产栈与开发栈共用 **3100–3102** 端口，切换时需先停止另一方。

## Node 运行时说明

| Cloudflare 能力 | Node/Docker 替代 |
|-------------------|------------------|
| Workers API | `tsx src/server.ts` + Hono |
| D1 | Postgres + Drizzle |
| R2 | `LOCAL_STORAGE_PATH` 本地目录 |
| Durable Workflow / Queue | 进程内 `node-*` 运行时 |
| Email Routing | `POST /inbound-email` + SMTP 网关 |
| Editor WebSocket | `ws-node.ts`（直连 `:3102` 或 app 反代） |

**邮件**

- 入站：`node apps/api/scripts/simulate-inbound-email.mjs --to handle@mail.dafthunk.com --from alice@example.com`
- 出站：写入 `{LOCAL_STORAGE_PATH}/outbound-emails/*.eml`

**存储**：默认本地 FS；设置 `COS_*` 将尝试 COS 适配器（尚未实现）。

## 文件说明

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 开发编排 |
| `docker-compose.prod.yml` | 实验性生产编排 |
| `Dockerfile` | `dev` / `deps` / `prod-api` / `prod-app` / `prod-www` / `prod-smtp-gateway` |
| `docker/entrypoint.sh` | 开发容器入口 |
| `docker/prod-api-entrypoint.sh` | 生产 API 迁移入口 |
| `docker/nginx/app.conf` | 生产 app 反代配置 |
| `scripts/prod-up.mjs` | 生产栈启动脚本 |
| `.env.docker.example` / `.env.docker.prod.example` | 环境变量模板 |

## 故障排查

| 现象 | 处理 |
|------|------|
| 端口占用 | 停止 prod/dev 另一方，或改 compose 端口映射 |
| API 长时间无响应 | 等待 2–3 分钟；查看 `docker compose logs dev` 是否有 `listening` |
| OAuth 失败 | 回调 URL 须为 `http://localhost:3102/...` |
| JWT 相关 500 | 检查 `.dev.vars` 中密钥是否已填写 |
| 邮件不触发 | 确认 DB 中 org 邮箱 handle 存在；用 simulate 脚本测试 |
| prod 构建失败 | 确认 lockfile 已更新：`docker compose run --rm dev pnpm install` |

## Cloudflare 生产部署

线上 Cloudflare Workers + Supabase Hyperdrive 部署说明见根目录 [README.md](../README.md#部署)。
