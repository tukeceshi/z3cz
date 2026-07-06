# Dafthunk

> Break it, fix it, prompt it, automatic, automatic, ...

基于 Cloudflare 基础设施构建的可视化工作流自动化平台。

![Workflow](./images/workflow.png)

## 概览

[Daf·thunk](https://en.wikipedia.org/wiki/Thunk) 是一个可视化工作流自动化平台，支持在浏览器中创建、管理和执行工作流。平台基于 Cloudflare Workers、D1、R2、AI 等能力，提供无服务器执行与持久化存储。

可视化编辑器基于 [React Flow](https://reactflow.dev/)，通过连接多种节点类型（含 AI 节点）构建复杂工作流。

## 功能特性

- **可视化工作流编辑器**：拖拽式界面，无需编写代码即可编排流程
- **AI 节点**：文本摘要、情感分析、翻译、图像分类、语音转写、图像生成等
- **无服务器执行**：工作流在 Cloudflare 全球网络上运行
- **实时监控**：通过 UI 或 API 查看执行状态与结果
- **持久化存储**：执行数据存储于 Cloudflare D1 与 R2
- **触发器与集成**：HTTP API、邮件、队列、Bot 等多种触发方式

## 技术栈

### 运行环境

- **pnpm** — Monorepo 包管理
- **TypeScript** — 静态类型
- **Vitest** — 单元与集成测试
- **Docker** — 本地开发容器化
- **Cloudflare** — 边缘部署与运行时

### 后端

- **Hono** — REST API 框架
- **Cloudflare Workers** — 无服务器执行
- **Cloudflare D1** — SQLite 数据库
- **Cloudflare R2** — 对象存储
- **Cloudflare AI** — 模型推理
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

> 完整 Docker 说明见 [docker/README.md](docker/README.md)。

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
docker compose run --rm dev node apps/api/scripts/generate-master-key.js
```

将输出的 `SECRET_MASTER_KEY` 写入 `apps/api/.dev.vars`。同时设置至少 32 字符的 `JWT_SECRET`：

```env
WEB_HOST=http://localhost:3101
WEBSITE_URL=http://localhost:3100
CLOUDFLARE_ENV=development

JWT_SECRET=你的_32_字符以上_随机字符串
SECRET_MASTER_KEY=上一步生成的_64_位_hex
```

**4. 启动开发栈**

```bash
docker compose --env-file .env.docker up --build
```

容器会自动安装依赖并执行本地 D1 迁移。

**5. 打开浏览器**

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站 |
| http://localhost:3101 | 产品应用 / 工作流编辑器 |
| http://localhost:3102 | API |

> 本地开发统一使用 **3100 / 3101 / 3102** 三个端口。

### OAuth 配置（可选）

如需 GitHub / Google 登录或第三方集成，在 `apps/api/.dev.vars` 中配置 OAuth 凭证。回调地址格式为 `http://localhost:3102/...`。

**GitHub 登录示例**

1. [创建 OAuth App](https://github.com/settings/applications/new)
2. Homepage URL：`http://localhost:3100`
3. Callback URL：`http://localhost:3102/auth/login/github`
4. 写入 `.dev.vars`：

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

**Google 登录（可选）**

- 重定向 URI：`http://localhost:3102/auth/login/google`

更多集成配置项见 `apps/api/.dev.vars.example` 与 [docker/README.md](docker/README.md)。

### 常用 Docker 命令

```bash
# 后台运行
docker compose --env-file .env.docker up -d --build

# 停止
docker compose down

# 单独启动某个服务
docker compose --profile split up app

# 在容器内运行测试
docker compose run --rm dev pnpm test
```

## 开发

### 项目结构

Monorepo（pnpm workspaces）：

- **`apps/api/`** — Cloudflare Workers API
  - `/src/routes/` — REST 路由
  - `/src/db/` — 数据库 schema 与迁移
  - `/src/runtime/` — 工作流运行时
- **`apps/app/`** — 产品 UI（React + Vite）
  - `/src/components/workflow/` — 可视化编辑器
  - `/src/pages/` — 页面与路由
  - `/src/services/` — API 客户端
- **`apps/www/`** — 营销站（React Router SSR）
- **`packages/types/`** — 共享类型
- **`packages/utils/`** — 共享工具
- **`packages/runtime/`** — 工作流节点运行时
- **`docker/`** — Docker 入口脚本与文档

### 开发命令

在容器内执行（或宿主机已安装 Node 20.19+ / pnpm 10.3+ 时本地执行）：

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

使用 Cloudflare D1（SQLite）+ Drizzle ORM。Docker 启动时会自动迁移；也可手动执行：

```bash
# 应用本地迁移
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:migrate

# 重置本地数据库（危险）
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:reset

# 生成新迁移
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:generate
```

查询本地 D1：

```bash
docker compose run --rm dev npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

#### 生产环境

```bash
pnpm --filter '@dafthunk/api' db:prod:migrate
pnpm --filter '@dafthunk/api' db:prod:reset   # 极度谨慎
```

### 队列

本地开发使用 `wrangler.jsonc` 中已配置的 Queue 绑定，无需手动创建 Cloudflare Queue。

使用流程：

1. 在 UI 中创建 Queue
2. 创建工作流，触发类型选择「Queue Message」
3. 为工作流添加 Queue 触发器
4. 使用 Queue Message 节点读取消息，Queue Publish 节点发布消息

## 部署

主分支通过 GitHub Actions 自动部署至 Cloudflare：

- **API** — Cloudflare Workers
- **产品 UI** — Cloudflare Workers
- **营销站** — Cloudflare Workers
- **数据库** — Cloudflare D1（自动迁移）
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

本地开发请使用 Docker 流程，详见 [docker/README.md](docker/README.md)。

## 致谢

架构与设计由团队主导完成；AI 工具辅助部分实现细节。
