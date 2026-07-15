# Dafthunk

> Break it, fix it, prompt it, automatic, automatic, ...

可视化工作流自动化平台。本地开发与实验性自托管使用 **Docker + Node API + Postgres**；线上生产可部署至 Cloudflare Workers。

![Workflow](./images/workflow.png)

## 概览

[Daf·thunk](https://en.wikipedia.org/wiki/Thunk) 支持在浏览器中创建、管理和执行工作流（[React Flow](https://reactflow.dev/)）。本地通过 Docker 运行 Node API、Postgres 与本地对象存储；生产可走 Cloudflare Workers + Supabase Postgres。

**功能**：可视化编排、AI 节点、HTTP / 邮件 / 队列等触发、组织级多租户。

**技术栈**：pnpm monorepo · TypeScript · Hono · React 19 · React Router v7 · Vite · Drizzle · Vitest · Docker ·（可选）Cloudflare Workers / R2 / Hyperdrive。

---

## 快速开始

### 前置要求

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2.1+（需支持 `up --wait`）
- Git

### 初始化（首次）

```bash
git clone https://github.com/tukeceshi/dafthunk.git
cd dafthunk

cp .env.docker.example .env.docker
cp apps/api/.dev.vars.example apps/api/.dev.vars

docker compose up -d --build --wait
```

首次 API 就绪约 **2–6 分钟**（WASM）。启动后会：

- 在命名卷 `/data/secrets/.dev.vars` 写入 `JWT_SECRET` / `SECRET_MASTER_KEY`（K1）
- API 自动幂等迁移（fast 重启在 boot stamp 有效时可跳过）
- 按服务隔离 `node_modules` 卷；`pnpm-lock` / 节点源未变时跳过 install / `extract-nodes`

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站 www |
| http://localhost:3101 | 产品 app（`/api` 反代至 API） |
| http://localhost:3102 | API |

请通过 **3101** 使用产品；不要把浏览器里的 API 指到 3102（Cookie 同源问题）。

### 登录

1. 打开 http://localhost:3101/login
2. 邮箱 + 密码点「登录 / 注册」
3. **首个注册用户**自动为超级管理员

OAuth（可选）写在 `apps/api/.dev.vars`，回调须经 app 同源反代，例如：

- GitHub：`http://localhost:3101/api/auth/login/github`
- Google：`http://localhost:3101/api/auth/login/google`

条目说明见 `apps/api/.dev.vars.example`。

---

## Docker 日常命令

默认栈：`docker-compose.yml` + `docker-compose.dev.yml`（Postgres + api + www + app）。

| 服务 | 容器名 | 端口 |
|------|--------|------|
| Postgres | `dafthunk-pg-dev` | 仅容器内 |
| API | `dafthunk-api-dev` | 3102 |
| www | `dafthunk-www-dev` | 3100 |
| app | `dafthunk-app-dev` | 3101 |

npm 别名：`pnpm dev` ≡ 启动；`pnpm dev:down` ≡ 停止；`pnpm dev:logs` ≡ 跟踪日志。

### 日常启动

```bash
# 推荐：构建 + 后台启动 + 等待健康检查
docker compose up -d --build --wait

# 已构建过、仅拉起
docker compose up -d --wait

# 状态 / 日志
docker compose ps
docker compose logs -f api www app
```

### 停止与重置

```bash
docker compose down          # 停容器，保留卷
docker compose down -v       # 删全部命名卷（DB、密钥、node_modules…）
docker compose down -v && docker compose up -d --build --wait   # 完全重置后启动
```

从旧共享卷升级、或 HMR / 依赖异常时，用一次 `down -v` 再启动。

### 有序重启

源码挂载进容器，多数改动靠 **HMR，无需重启**。需要重启时**按顺序**操作，不要对整栈直接 `docker compose restart`（无健康等待）。

```bash
# 1) 选择 API 模式（fast | warm | full），文件只消费一次
docker compose exec api sh -c 'rm -f /app/data/storage/cache/restart-mode.* && touch /app/data/storage/cache/restart-mode.fast'

# 2) 重启 API → 等 healthy → 再起前端
docker compose restart api
docker compose up -d --wait api
docker compose restart www app
```

| 模式 | 何时 | 行为 |
|------|------|------|
| `fast` | 日常改 API 业务代码 | stamp 有效时跳过 migrate / AI bootstrap |
| `warm` | 改了 `packages/runtime` / WASM | 额外预加载运行时 |
| `full` | lockfile、migration、种子变更 | 强制 install、migrate、bootstrap、WASM 预热 |

| 场景 | 命令 |
|------|------|
| 仅 API | 上表步骤 1 + `restart api` + `up -d --wait api` |
| 仅 www | `docker compose restart www` |
| 仅 app | `docker compose up -d --wait api` 后 `docker compose restart app` |
| 改了 Dockerfile / entrypoint | `docker compose up -d --build` 后再做有序重启 |

启动阶段：`GET /health` 的 `phase`，或 `docker compose exec api cat /app/data/storage/cache/boot-phase.txt`。

### 数据库与清库

迁移在 API 启动时自动执行。手动：

```bash
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:migrate && node scripts/write-boot-stamp.mjs'
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:generate'
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:studio'
```

清空业务数据（保留表结构）：

```bash
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:reset'
```

容器内连接串：`postgresql://postgres:postgres@supabase-db:5432/postgres`。

### 可选编排

```bash
# 宿主机暴露 Postgres 5432
docker compose -f docker-compose.yml -f docker-compose.host-db.yml up -d --wait

# 向 api 注入 Cloudflare 凭证（需在 .env.docker 中填写）
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --wait
```

### 故障排查

| 现象 | 处理 |
|------|------|
| 端口占用 | 先停 prod/dev 另一方，或改 `.env.docker` 端口 |
| API 长时间无响应 | 首次 2–6 分钟；`docker compose logs -f api` |
| www/app 异常 | `docker compose ps` 看健康状态 |
| entrypoint / 镜像改了不生效 | `docker compose up -d --build` 后有序重启 |
| 登录 401 | 用 http://localhost:3101；清库后刷新再注册 |
| 登录/API 500、503 | API 可能仍在启动；看日志 |
| OAuth 失败 | 回调须为 `http://localhost:3101/api/auth/login/{provider}` |
| JWT 500 | `docker compose exec api cat /data/secrets/.dev.vars` |
| Secrets 解密失败 | 面板重配，或 `down -v` 后重建（密钥卷轮换，旧密文不可解密） |
| 勿双写密钥 | Docker 开发只把 `JWT_SECRET` / `SECRET_MASTER_KEY` 放在 K1 卷，不要写入 `apps/api/.dev.vars` |

探测：

```bash
docker compose exec api node -e "fetch('http://127.0.0.1:3102/health').then(r=>console.log('api',r.status))"
docker compose exec app node -e "fetch('http://127.0.0.1:3101/api/health').then(r=>console.log('proxy',r.status))"
```

---

## 项目结构

```
apps/api/            Hono API（本地 Node / 可选 Workers）
apps/app/            产品 UI（React + Vite）
apps/www/            营销站（React Router SSR）
apps/smtp-gateway/   入站 SMTP（自托管）
packages/types/      共享类型
packages/utils/      共享工具
packages/runtime/    工作流节点运行时（含 bundled TTF 字体供 SVG→栅格）
docker/              开发 entrypoint、生产 Nginx
```

| Cloudflare | Node / Docker |
|------------|---------------|
| Workers API | `tsx` + Hono |
| D1 | Postgres + Drizzle |
| R2 | `LOCAL_STORAGE_PATH` |
| Durable Workflow / Queue | 进程内运行时 |
| Email Routing | `POST /inbound-email` + SMTP 网关 |
| Editor WebSocket | `:3102` 或 app 反代 |

---

## 部署

### Docker 自托管（实验性）

```bash
cp .env.docker.prod.example .env.docker.prod   # 编辑密钥
pnpm prod:env                                   # 可选：同步示例字段
pnpm prod:up                                    # ≡ compose -f docker-compose.prod.yml --env-file .env.docker.prod up -d --build
pnpm prod:down
```

栈：Postgres + API + www（SSR）+ app（Nginx + `/api`）+ SMTP。端口与开发栈同为 **3100–3102**，切换时先停另一方。SMTP：`localhost:2525` → `/inbound-email/raw`。

### Cloudflare

GitHub Actions 可将主分支部署为 Workers（API / app / www），库用 Supabase + Hyperdrive，对象用 R2。

部署密钥示例：

```bash
echo "ACCOUNT_ID" | pnpm wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
echo "API_TOKEN"  | pnpm wrangler secret put CLOUDFLARE_API_TOKEN --env production
echo "R2_KEY"     | pnpm wrangler secret put R2_ACCESS_KEY_ID --env production
echo "R2_SECRET"  | pnpm wrangler secret put R2_SECRET_ACCESS_KEY --env production
```

Marketing 站点构建变量（Cloudflare Dashboard → Worker → Build）：

| 变量 | 说明 |
|------|------|
| `VITE_API_HOST` | API 地址 |
| `VITE_APP_URL` | 应用地址 |
| `VITE_WEBSITE_URL` | 营销站地址 |
| `VITE_CONTACT_EMAIL` | 联系邮箱 |
| `VITE_GA_MEASUREMENT_ID` | GA4（可选；Consent Mode v2，未设则不加载） |

手动发布：

```bash
pnpm --filter '@dafthunk/api' deploy
pnpm --filter '@dafthunk/app' deploy
pnpm --filter '@dafthunk/www' deploy
```

远程 DB 迁移：

```bash
DATABASE_URL="postgresql://..." pnpm --filter '@dafthunk/api' db:migrate
```

---

## 贡献者

```bash
# CI / 宿主机（需 Node 22+ / pnpm）
pnpm build && pnpm test && pnpm typecheck && pnpm lint

# 在已运行的开发栈内跑测试
docker compose run --rm api sh -c 'cd /app && pnpm test'
```

前端 i18n：`apps/app` 用户可见文案走 `useTranslation()`，同步 `en.ts` / `zh.ts`；默认语言 `zh`。

欢迎 PR：fork → 功能分支 → commit → push → 开 PR。本地请用上文 Docker 流程开发。
