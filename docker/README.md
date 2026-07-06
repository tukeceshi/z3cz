# Docker 本地开发

使用 Docker 在容器内运行完整开发栈，无需在宿主机安装 Node.js 或 pnpm。

## 前置要求

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2
- Git
- Cloudflare 账号（使用 AI、远程 preview 等功能时需要）

## 初始化流程

### 1. 克隆仓库

```bash
git clone https://github.com/dafthunk-com/dafthunk.git
cd dafthunk
```

### 2. 准备 Docker 环境变量

```bash
cp .env.docker.example .env.docker
```

`.env.docker` 中可调整 Node / pnpm 版本、Cloudflare 凭证、是否在启动时执行 D1 迁移等。

### 3. 准备 API 密钥配置

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

编辑 `apps/api/.dev.vars`，至少填写以下必填项：

```env
WEB_HOST=http://localhost:3101
WEBSITE_URL=http://localhost:3100
CLOUDFLARE_ENV=development

JWT_SECRET=至少_32_个字符的随机字符串
SECRET_MASTER_KEY=64位十六进制字符串
```

生成 `SECRET_MASTER_KEY`：

```bash
docker compose run --rm dev node apps/api/scripts/generate-master-key.js
```

将输出值写入 `apps/api/.dev.vars` 中的 `SECRET_MASTER_KEY`。

`JWT_SECRET` 可使用任意 32 字符以上的随机字符串。

> 首次启动时，若 `apps/api/.dev.vars` 不存在，入口脚本会自动从示例文件创建，但仍需手动填入密钥后重启。

### 4. 启动开发栈

```bash
docker compose --env-file .env.docker up --build
```

容器启动时会自动：

1. 安装 pnpm 依赖（首次或 `node_modules` 为空时）
2. 执行本地 D1 数据库迁移（`RUN_DB_MIGRATE=true` 时）

### 5. 访问服务

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站（`@dafthunk/www`） |
| http://localhost:3101 | 产品应用（`@dafthunk/app`） |
| http://localhost:3102 | API（`@dafthunk/api`，wrangler dev） |

> 本地开发统一使用 **3100 / 3101 / 3102** 三个端口。

### 6. 配置 OAuth（可选）

登录与第三方集成需要在 `apps/api/.dev.vars` 中配置 OAuth 应用。回调地址均指向 `http://localhost:3102`。

**用户登录 — GitHub**

1. 前往 [GitHub OAuth Apps](https://github.com/settings/applications/new)
2. 创建应用：
   - Homepage URL：`http://localhost:3100`
   - Authorization callback URL：`http://localhost:3102/auth/login/github`
3. 写入 `.dev.vars`：

```env
GITHUB_CLIENT_ID=你的_Client_ID
GITHUB_CLIENT_SECRET=你的_Client_Secret
```

**用户登录 — Google（可选）**

1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 创建 OAuth 2.0 客户端，重定向 URI：`http://localhost:3102/auth/login/google`
3. 写入 `.dev.vars`：

```env
GOOGLE_CLIENT_ID=你的_Client_ID
GOOGLE_CLIENT_SECRET=你的_Client_Secret
```

更多集成 OAuth（Gmail、Discord、Reddit 等）配置项见 `apps/api/.dev.vars.example`。

## 常用命令

```bash
# 启动（前台）
docker compose --env-file .env.docker up --build

# 后台启动
docker compose --env-file .env.docker up -d --build

# 停止
docker compose down

# 仅启动单个服务（调试时使用）
docker compose --profile split up app
docker compose --profile split up api
docker compose --profile split up www

# 在容器内执行命令
docker compose run --rm dev pnpm test
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:migrate
docker compose run --rm dev pnpm --filter '@dafthunk/api' db:reset

# CI 构建镜像
docker build --target build -t dafthunk-build .
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 开发镜像与 CI 构建目标 |
| `docker-compose.yml` | 本地编排（默认 `dev` 服务启动全部应用） |
| `docker/entrypoint.sh` | 启动前依赖安装与 D1 迁移 |
| `.env.docker.example` | Docker Compose 环境变量模板 |
| `.dockerignore` | 构建上下文排除规则 |

## 镜像说明

- **基础镜像**：`node:20.19.0-bookworm-slim`
- **包管理器**：pnpm 10.3.0（corepack）
- **构建参数**：`NODE_VERSION`、`PNPM_VERSION`
- **数据卷**：
  - `dafthunk_node_modules` — 依赖缓存
  - `dafthunk_pnpm_store` — pnpm 全局 store

## 注意事项

1. **生产部署不在 Docker 中**：生产环境部署至 Cloudflare Workers，见根目录 README「部署」章节。
2. **Wrangler 本地模式**：API 使用 `wrangler dev` 本地模拟 D1 / Queue 等绑定，无需手动 `wrangler login` 或创建 D1 数据库。
3. **Cloudflare 远程功能**：AI 推理、R2、远程 preview 等需在 `.dev.vars` 或 `.env.docker` 中配置 `CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN`。
4. **源码热更新**：项目目录挂载到 `/app`，修改代码后各 dev server 会自动重载。
5. **队列**：`wrangler.jsonc` 已包含本地 Queue 绑定，无需额外创建 Cloudflare Queue。

## 故障排查

| 现象 | 处理方式 |
|------|----------|
| 端口被占用 | 修改 `docker-compose.yml` 中的端口映射 |
| 依赖安装失败 | 确认 lockfile 与 pnpm 版本匹配；删除卷后重建：`docker compose down -v` |
| OAuth 登录失败 | 检查回调 URL 是否为 `http://localhost:3102/...` |
| API 无法访问 | 确认 `apps/api/.dev.vars` 中密钥已填写并重启容器 |
| D1 迁移报错 | 设置 `RUN_DB_MIGRATE=false` 跳过，或手动执行 `docker compose run --rm dev pnpm --filter '@dafthunk/api' db:migrate` |
