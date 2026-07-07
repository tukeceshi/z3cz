# Dafthunk

> Break it, fix it, prompt it, automatic, automatic, ...

基于 Cloudflare 与 Node 双运行时构建的可视化工作流自动化平台。**本地开发与实验性自托管**使用 Docker + Node API + Postgres；**线上生产**仍可部署至 Cloudflare Workers。

![Workflow](./images/workflow.png)

## 概览

[Daf·thunk](https://en.wikipedia.org/wiki/Thunk) 是一个可视化工作流自动化平台，支持在浏览器中创建、管理和执行工作流。本地开发通过 Docker 运行 Node API、Postgres 与本地对象存储；生产环境可部署至 Cloudflare Workers，数据库使用 Supabase Postgres。

## 更新说明

| 日期 | 说明 |
|------|------|
| 2026-07-07 | **邮箱密码登录**：`POST /auth/register`、`POST /auth/login/password`；首个注册用户自动为超级管理员；清库 `pnpm --filter '@dafthunk/api' db:reset`；OAuth 回调须走 app 同源 `/api` 代理。 |
| 2026-07-07 | **Node 本地运行时**：API 从 Cloudflare Workers 迁移为 Hono + `@hono/node-server`；D1/R2/DO/Queue 等绑定替换为 Postgres、本地 FS 与进程内实现；新增入站邮件 webhook、SMTP 网关、实验性 `docker-compose.prod.yml`（含 www Node SSR）。 |
| 2026-07-06 | Docker 生产编排、`pnpm prod:up`、Nginx 静态 app 与 API 容器镜像。 |
| 2026-07-05 | Docker 开发栈（3100/3101/3102）、Postgres 迁移与编辑器 WebSocket Node 路径。 |

可视化编辑器基于 [React Flow](https://reactflow.dev/)，通过连接多种节点类型（含 AI 节点）构建复杂工作流。

## 功能特性

- **可视化工作流编辑器**：拖拽式界面，无需编写代码即可编排流程
- **AI 节点**：文本摘要、情感分析、翻译、图像分类、语音转写、图像生成等
- **双运行时**：本地 Node + Docker；线上 Cloudflare Workers（可选）
- **持久化存储**：元数据在 Postgres；对象默认本地 FS（线上为 R2）
- **触发器与集成**：HTTP API、邮件、队列、Bot 等多种触发方式

## 技术栈

### 运行环境

- **pnpm** — Monorepo 包管理
- **TypeScript** — 静态类型
- **Vitest** — 单元与集成测试
- **Docker** — 本地开发与实验性自托管
- **Cloudflare** — 线上边缘部署（可选）

### 后端

- **Hono** — REST API 框架
- **Node.js** — 本地 API 运行时（`@hono/node-server`）
- **Cloudflare Workers** — 线上 API 运行时（可选）
- **Supabase Postgres** — 主数据库（Drizzle ORM）
- **本地 FS / Cloudflare R2** — 对象存储（环境相关）
- **Drizzle ORM** — 类型安全数据库操作
- **Zod** — 运行时校验

### 前端

- **Vite** — 构建工具
- **React 19** — UI 框架
- **React Router v7** — 路由
- **React Flow** — 节点编辑器
- **Tailwind CSS** — 样式
- **shadcn/ui** — 组件库

## 快速开始

### 前置要求

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2
- Git
- Cloudflare 账号（AI、远程 preview 等功能需要）

### 初始化

**1. 克隆仓库**

```bash
git clone https://github.com/tukeceshi/dafthunk.git
cd dafthunk
```

**2. 复制环境配置**

```bash
cp .env.docker.example .env.docker
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

**3. 生成并填写密钥**

```bash
docker compose run --rm -e RUN_DB_MIGRATE=false dev node apps/api/scripts/generate-master-key.js
```

将输出的 `SECRET_MASTER_KEY` 与 `JWT_SECRET` 写入 `apps/api/.dev.vars`：

```env
WEB_HOST=http://localhost:3101
WEBSITE_URL=http://localhost:3100
CLOUDFLARE_ENV=development

JWT_SECRET=脚本输出的_JWT_SECRET
SECRET_MASTER_KEY=脚本输出的_SECRET_MASTER_KEY
```

**4. 启动开发栈**

```bash
docker compose --env-file .env.docker up --build
```

容器会自动安装依赖、启动 Postgres 并执行数据库迁移。

**5. 打开浏览器**

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站 |
| http://localhost:3101 | 产品应用 / 工作流编辑器 |
| http://localhost:3102 | API |

> 本地开发统一使用 **3100 / 3101 / 3102** 三个端口。API 首次启动约需 **2–6 分钟**（WASM 初始化），日志出现 `[api] Node server listening` 后即可使用。`restart dev` 后 app 会等 API 就绪再启动，期间请勿刷新登录页。

### 登录与首用户

1. 打开 http://localhost:3101/login
2. 使用邮箱 + 密码，点击 **「登录 / 注册」**
3. **首个注册用户**自动获得超级管理员（`users.role = admin`）
4. 若邮箱尚未注册，系统会提示确认注册后再登录

产品 UI 通过 `/api` 代理访问 API（`VITE_API_HOST=/api`），会话 Cookie 与页面同源，请勿在开发环境将 API 指到 `http://localhost:3102`（会导致 Cookie 无法写入）。

**清空所有用户与业务数据**（保留表结构；不删除 `LOCAL_STORAGE_PATH` 文件）：

```bash
docker compose exec dev sh -c "cd /app/apps/api && pnpm db:reset"
```

清库后刷新登录页；系统会在首次注册前清除浏览器中的失效会话 Cookie。

### OAuth 配置（可选）

如需 GitHub / Google 登录或第三方集成，在 `apps/api/.dev.vars` 中配置 OAuth 凭证。**回调地址须与 app 同源**（经 `/api` 反代）：

**GitHub 登录示例**

1. [创建 OAuth App](https://github.com/settings/applications/new)
2. Homepage URL：`http://localhost:3100`
3. Callback URL：`http://localhost:3101/api/auth/login/github`
4. 写入 `.dev.vars`：

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

**Google 登录（可选）**

- 重定向 URI：`http://localhost:3101/api/auth/login/google`

更多集成配置项见 `apps/api/.dev.vars.example`。

### 常用 Docker 命令

```bash
# 后台运行
docker compose --env-file .env.docker up -d --build

# 停止
docker compose down

# 重启开发容器（修改代码未生效、API 路由异常或更新 .dev.vars 后）
docker compose --env-file .env.docker restart dev

# 查看日志
docker compose --env-file .env.docker logs -f dev

# 单独启动某个服务
docker compose --profile split up app

# 在容器内运行测试
docker compose run --rm dev pnpm test

# 数据库迁移
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:migrate
```

### 故障排查

| 现象 | 处理 |
|------|------|
| 端口占用 | 停止 prod/dev 另一方，或改 compose 端口映射 |
| API 长时间无响应 | 等待 2–6 分钟；查看 `docker compose logs dev` 是否有 `listening` |
| 代码/API 修改未生效 | 执行 `docker compose --env-file .env.docker restart dev`，等待约 2–6 分钟直至 `[api] Node server listening` |
| 登录返回 401 | 确认通过 http://localhost:3101 访问；清库后刷新登录页再注册 |
| 登录/API 返回 500 或 503 | API 可能仍在启动（重启后约 2–6 分钟）；查看 `docker compose logs dev` 是否有 `listening`；若日志报 `JWT_SECRET`，运行 `generate-master-key.js` 更新 `.dev.vars` |
| OAuth 失败 | 回调 URL 须为 `http://localhost:3101/api/auth/login/{provider}` |
| JWT 相关 500 | 检查 `.dev.vars` 中 `JWT_SECRET`、`SECRET_MASTER_KEY` 是否已填写 |
| 邮件不触发 | 确认 DB 中 org 邮箱 handle 存在；用 simulate 脚本测试 |

## 开发

### 项目结构

Monorepo（pnpm workspaces）：

- **`apps/api/`** — Hono API（本地 Node / 线上 Workers）
  - `/src/routes/` — REST 路由
  - `/src/db/` — 数据库 schema 与迁移
  - `/src/runtime/` — 工作流运行时
- **`apps/app/`** — 产品 UI（React + Vite）
  - `/src/components/workflow/` — 可视化编辑器
  - `/src/pages/` — 页面与路由
  - `/src/services/` — API 客户端
- **`apps/www/`** — 营销站（React Router SSR）
- **`apps/smtp-gateway/`** — 入站 SMTP 网关（自托管）
- **`packages/types/`** — 共享类型
- **`packages/utils/`** — 共享工具
- **`packages/runtime/`** — 工作流节点运行时
- **`docker/`** — Docker 入口脚本（详细说明见本 README）

### Node 运行时说明（Docker）

| Cloudflare 能力 | Node/Docker 替代 |
|-------------------|------------------|
| Workers API | `tsx src/server.ts` + Hono |
| D1 | Postgres + Drizzle |
| R2 | `LOCAL_STORAGE_PATH` 本地目录 |
| Durable Workflow / Queue | 进程内 `node-*` 运行时 |
| Email Routing | `POST /inbound-email` + SMTP 网关 |
| Editor WebSocket | `ws-node.ts`（直连 `:3102` 或 app 反代） |

### 开发命令

在容器内执行（或宿主机已安装 Node 22.12+ / pnpm 10.3+ 时本地执行）：

```bash
# 启动全部服务（Docker 内默认使用 dev:docker）
pnpm dev:docker

# 本地非 Docker 开发
pnpm dev

# 构建
pnpm build

# 测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查与格式化
pnpm lint
pnpm format
pnpm check
```

#### 按工作区执行

```bash
# API
pnpm --filter '@dafthunk/api' dev
pnpm --filter '@dafthunk/api' deploy

# 产品 UI
pnpm --filter '@dafthunk/app' dev
pnpm --filter '@dafthunk/app' deploy

# 营销站
pnpm --filter '@dafthunk/www' dev
pnpm --filter '@dafthunk/www' deploy

# 类型包
pnpm --filter '@dafthunk/types' build
```

### 数据库

使用 **Supabase Postgres** + Drizzle ORM。Docker 启动时会自动迁移；也可手动执行：

```bash
# 应用本地迁移（需 Postgres 运行，Docker 内默认连 supabase-db）
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:migrate

# 从 schema 生成新迁移
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:generate

# 打开 Drizzle Studio
docker compose run --rm -p 4983:4983 dev pnpm --filter '@dafthunk/api' db:studio
```

本地连接串（Docker 默认）：

```env
DATABASE_URL=postgresql://postgres:postgres@supabase-db:5432/postgres
```

#### 生产环境（Supabase + Hyperdrive）

1. 在 [supabase.com](https://supabase.com) 创建项目
2. 复制 **Transaction pooler** 连接串（端口 6543）
3. 在 Cloudflare Dashboard 创建 **Hyperdrive**，指向该连接串
4. 将 Hyperdrive ID 写入 `apps/api/wrangler.jsonc` 生产环境配置
5. 对 Supabase 数据库执行迁移：

```bash
DATABASE_URL="postgresql://..." pnpm --filter '@dafthunk/api' db:migrate
```

### 队列

**Node / Docker**：进程内队列，无需 Cloudflare Queue。

**Cloudflare 生产**：使用 `wrangler.jsonc` 中的 Queue 绑定。

使用流程：

1. 在 UI 中创建 Queue
2. 创建工作流，触发类型选择「Queue Message」
3. 为工作流添加 Queue 触发器
4. 使用 Queue Message 节点读取消息，Queue Publish 节点发布消息

## 部署

### Docker 自托管（实验性）

```bash
pnpm prod:env && pnpm prod:up
```

生产栈：`Postgres + Node API + www（SSR）+ app（Nginx + /api 反代）+ SMTP 网关`。与开发栈共用 **3100–3102** 端口，切换时需先停止另一方。

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站（Node SSR） |
| http://localhost:3101 | 产品 app（Nginx + `/api` 反代） |
| http://localhost:3102 | API |
| localhost:2525 | SMTP → `/inbound-email/raw` |

```bash
pnpm prod:env          # 从 .dev.vars 同步密钥到 .env.docker.prod
pnpm prod:up           # 构建并启动
pnpm prod:down         # 停止
```

### Cloudflare 生产

主分支可通过 GitHub Actions 部署至 Cloudflare：

- **API** — Cloudflare Workers
- **产品 UI** — Cloudflare Workers
- **营销站** — Cloudflare Workers
- **数据库** — Supabase Postgres（经 Cloudflare Hyperdrive）
- **存储** — Cloudflare R2

### 生产密钥

部署前需配置 Analytics Engine 与 R2 预签名 URL 相关密钥。

**1. 创建 Cloudflare API Token**

1. 打开 https://dash.cloudflare.com/profile/api-tokens
2. 创建 Custom Token，权限：**Account → Analytics → Read**

**2. 设置生产密钥**

```bash
echo "YOUR_ACCOUNT_ID" | pnpm wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
echo "YOUR_API_TOKEN" | pnpm wrangler secret put CLOUDFLARE_API_TOKEN --env production
```

**3. 创建 R2 API Token（预签名 URL）**

1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. 权限：Object Read & Write，指定 bucket

**4. 设置 R2 密钥**

```bash
echo "YOUR_ACCESS_KEY_ID" | pnpm wrangler secret put R2_ACCESS_KEY_ID --env production
echo "YOUR_SECRET_ACCESS_KEY" | pnpm wrangler secret put R2_SECRET_ACCESS_KEY --env production
```

**5. 营销站配置**

详见 [apps/www/README.md](apps/www/README.md)。

### 手动部署

```bash
pnpm --filter '@dafthunk/api' deploy
pnpm --filter '@dafthunk/app' deploy
pnpm --filter '@dafthunk/www' deploy
```

## 参与贡献

欢迎提交 Pull Request：

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送分支（`git push origin feature/amazing-feature`）
5. 创建 Pull Request

本地开发请使用上文 Docker 流程。

## 致谢

架构与设计由团队主导完成；AI 工具辅助部分实现细节。
