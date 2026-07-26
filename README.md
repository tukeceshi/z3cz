# Dafthunk

> Break it, fix it, prompt it, automatic, automatic, ...

可视化工作流自动化平台：浏览器内编排与执行工作流（[React Flow](https://reactflow.dev/)）。自托管与本地开发用 **Docker + Node API + Postgres**；也可部署到 Cloudflare Workers。

![Workflow](./images/workflow.png)

## 概览

**功能**：可视化编排、AI 节点、HTTP / 邮件 / 队列等触发、组织级多租户。

**技术栈**：pnpm monorepo · TypeScript · Hono · React 19 · React Router v7 · Vite · Drizzle · Vitest · Docker ·（可选）Cloudflare Workers / R2 / Hyperdrive。

---

## 快速开始

### 一键部署

面向 Linux 服务器自托管，与下方「本地开发」相互独立。

#### 系统要求

- Linux（推荐 **Ubuntu**）
- root 或 sudo、可访问外网
- 建议可用内存约 **4G**（内存 + swap；不足时脚本会对话引导加 swap）

#### 安装

建议（可选，非必须）先更新系统；耗时长，且可能重启 SSH，宜在 `tmux`/`screen` 中执行：

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

然后一键安装：

```bash
wget -qO- https://raw.githubusercontent.com/tukeceshi/dafthunk/main/install-dafthunk | sudo bash
```

一键脚本会依次：

1. 选择提示语言（默认中文；`--lang en` 或 `DAFTHUNK_LANG=en`）  
2. 内存检查：已满足约 4G+ 则直接通过；不足则询问 swap（回车默认 2G，可输入 2～4，或 `0` 跳过）  
3. 显示服务器当前时区，默认保持；可选改为其他 IANA（建议默认 `Asia/Shanghai`）  
4. `apt update` 并安装 `docker.io`、Compose、`git`（**不含** `apt upgrade`）  
5. clone → 向导写配置 → `launcher rebuild`（串行构建，适合小内存机）

默认目录 `/var/dafthunk`（`DAFTHUNK_INSTALL_DIR` 可改）。SSH 下一键管道安装仍会通过 `/dev/tty` 交互提问；无控制台时才全用默认值。有 `tmux`/`screen` 时 rebuild 在**后台会话**中启动（`wget|bash` 下可能需手动 `tmux attach -t dafthunk-install`）。打开打印的 URL 注册；**首个用户**为平台管理员。本地无公网域名时可用 `localhost` + 端口。补充见下方「部署」。

#### 更新

```bash
cd /var/dafthunk && git pull && docker-host/launcher rebuild
```

#### 应急（卡死 / SSH 断开）

| 情况 | 命令 |
|------|------|
| 构建中断 / 断线 | `cd /var/dafthunk/docker-host && ./launcher rebuild` 或 `tmux attach -t dafthunk-install` |
| 尚未生成配置 | `cd /var/dafthunk/docker-host && ./dafthunk-setup` |
| 整段接着装 | `sudo bash /var/dafthunk/install-dafthunk --resume` |
| 查看安装日志 | `less /var/dafthunk/install.log` |
| 失败留下的备份目录 | `/var/dafthunk.backup.*` 确认无用后可删 |

`shared/` 默认保留；勿轻易删除。卡住时可 `Ctrl+C`，再 `./launcher logs` 后重新 `rebuild`。

---

### 本地开发

多端口开发栈（`:3100` / `:3101` / `:3102`），与一键部署的 compose 项目隔离。

#### 前置要求

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2.1+（需支持 `up --wait`）
- Git

#### Docker 安装

推荐 **Ubuntu**。装完后用 `docker --version`、`docker compose version` 确认。

**Ubuntu / CentOS / RHEL：**

```bash
curl -fsSL https://get.docker.com | sudo sh
```

CentOS / RHEL 若未自动启动：`sudo systemctl enable --now docker`。  
若需免 sudo：`sudo usermod -aG docker $USER`，然后重新登录。

**macOS：** `brew install --cask docker`，或 [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)。

**Windows：** [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)，安装时启用 WSL 2。

#### 启动

```bash
git clone https://github.com/tukeceshi/dafthunk.git
cd dafthunk
docker compose up -d --build --wait   # 或 pnpm dev
```

默认不必复制环境文件；容器会生成 `apps/api/.dev.vars`。改端口或 Cloudflare 等时，再从对应 `.example` 复制后编辑。

首次 API 约 **30–90 秒**就绪（密钥卷、迁移、按服务隔离的 `node_modules`）。

| 地址 | 服务 |
|------|------|
| http://localhost:3100 | 营销站 www |
| http://localhost:3101 | 产品 app（`/api` 反代至 API） |
| http://localhost:3102 | API |
| http://localhost:8080 | 可选同源 Gateway（`pnpm dev:gateway`） |

请用 **3101** 使用产品；勿把浏览器 API 指到 3102（Cookie 同源）。验证单域名时用 **8080**，勿与 3101 混用 Cookie。

#### 登录

1. 打开 http://localhost:3101/login
2. 邮箱 + 密码「登录 / 注册」
3. **首个注册用户**为超级管理员

可选 GitHub / Google：在 **Admin → 登录方式** 配置；开发回调须同源，如 `http://localhost:3101/api/auth/login/github`。

---

## Docker 日常命令（本地开发）

默认栈：`docker-compose.yml` + `docker-compose.dev.yml`。

| 服务 | 容器名 | 端口 |
|------|--------|------|
| Postgres | `dafthunk-pg-dev` | 仅容器内 |
| API | `dafthunk-api-dev` | 3102 |
| www | `dafthunk-www-dev` | 3100 |
| app | `dafthunk-app-dev` | 3101 |

别名：`pnpm dev` / `dev:down` / `dev:logs`。

### 启动与停止

```bash
docker compose up -d --build --wait    # 构建并启动
docker compose up -d --wait            # 已构建过
docker compose ps
docker compose logs -f api www app

docker compose down                    # 停容器，保留卷
docker compose down -v                 # 删命名卷（DB、密钥、node_modules…）
```

依赖或 HMR 异常时，可 `down -v` 后重新启动。

### 有序重启

源码挂载：**前端** Vite HMR；**API** 为 `tsx watch` 整进程重启。Windows bind mount 下 API 已开文件轮询（`CHOKIDAR_USEPOLLING`）。进程重启默认可跳过 migrate（boot stamp 有效时）；`FORCE_DB_MIGRATE=1` 可强制迁移。

容器级重启请按序操作，避免对整栈直接 `docker compose restart`：

```bash
docker compose exec api sh -c 'rm -f /app/data/storage/cache/restart-mode.* && touch /app/data/storage/cache/restart-mode.fast'
docker compose restart api
docker compose up -d --wait api
docker compose restart www app
```

| 模式 | 何时 |
|------|------|
| `fast` | 日常改 API 业务代码 |
| `warm` | 改了 `packages/runtime` |
| `full` | lockfile、migration、种子变更 |

| 场景 | 命令 |
|------|------|
| 仅 www | `docker compose restart www` |
| 仅 app | `up -d --wait api` 后 `restart app` |
| 改了 Dockerfile / entrypoint | `up -d --build` 后再有序重启 |

启动阶段：`GET /health` 的 `phase`，或 `docker compose exec api cat /app/data/storage/cache/boot-phase.txt`。

### 数据库

迁移在 API 启动时自动执行。手动：

```bash
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:migrate && node scripts/write-boot-stamp.mjs'
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:generate'
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:studio'
docker compose exec api sh -c 'cd /app/apps/api && pnpm db:reset'   # 清业务数据，保留表结构
```

容器内：`postgresql://postgres:postgres@supabase-db:5432/postgres`。

### 可选编排

```bash
# 宿主机暴露 Postgres 5432
docker compose -f docker-compose.yml -f docker-compose.host-db.yml up -d --wait

# 向 api 注入 Cloudflare 凭证（在 .env.docker 中填写）
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --wait
```

### 故障排查

| 现象 | 处理 |
|------|------|
| 端口占用 | 改 `.env.docker`；自托管用 `dafthunk-host`（可与 310x 并存） |
| API 长时间无响应 | 首次约 1–2 分钟；`docker compose logs -f api` |
| www/app 异常 | `docker compose ps` |
| 配置/镜像不生效 | `up -d --build` 后有序重启 |
| 登录 401 | 用 http://localhost:3101；清库后刷新再注册 |
| Gateway Cookie 错乱 | 只用 http://localhost:8080 |
| 登录/API 500、503 | API 可能仍在启动 |
| OAuth 失败 | Admin → 登录方式；回调 `http://localhost:3101/api/auth/login/{provider}` |
| JWT 500 | `docker compose exec api cat /data/secrets/.dev.vars` |
| Secrets 解密失败 | 面板重配，或 `down -v` 后重建 |
| 勿双写密钥 | Docker 开发勿把 `JWT_SECRET` / `SECRET_MASTER_KEY` 写入 `apps/api/.dev.vars` |

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
apps/smtp-gateway/   入站 SMTP（可选；host 栈默认不起）
packages/types/      共享类型
packages/utils/      共享工具
packages/runtime/    工作流节点运行时
docker-host/         自托管 launcher / setup（Caddy 单域名）
docker/              开发 entrypoint、Nginx、Caddyfile.dev
```

本地 Docker 与 Cloudflare 能力大致对应：Workers → Node Hono；D1 → Postgres；R2 → 本地对象存储；Email Routing → SMTP 网关等。细节见下方 Cloudflare。

---

## 部署

一键安装与更新见上文「快速开始 → 一键部署」。本节为补充。

单域名 + Caddy，与开发栈隔离（compose project `dafthunk-host`）。详见 [docker-host/README.md](./docker-host/README.md)。

**已有仓库（非一键）：** `cd docker-host && ./dafthunk-setup`（写配置后自动 rebuild）。

| 操作 | 命令 |
|------|------|
| 状态 / 日志 / 停止 / 再起 | `./launcher status\|logs\|stop\|start` |
| pnpm 别名（可选） | `pnpm host:setup` / `host:rebuild` 等 |

旧版多端口 `pnpm prod:up` 已弃用，请用 `docker-host/launcher`。

### Cloudflare

可用 GitHub Actions 将主分支部署为 Workers（API / app / www），库用 Supabase + Hyperdrive，对象用 R2。

```bash
echo "ACCOUNT_ID" | pnpm wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
echo "API_TOKEN"  | pnpm wrangler secret put CLOUDFLARE_API_TOKEN --env production
echo "R2_KEY"     | pnpm wrangler secret put R2_ACCESS_KEY_ID --env production
echo "R2_SECRET"  | pnpm wrangler secret put R2_SECRET_ACCESS_KEY --env production
```

| 构建变量 | 说明 |
|----------|------|
| `VITE_API_HOST` | API 地址 |
| `VITE_APP_URL` | 应用地址 |
| `VITE_WEBSITE_URL` | 营销站地址 |
| `VITE_CONTACT_EMAIL` | 联系邮箱 |
| `VITE_GA_MEASUREMENT_ID` | GA4（可选） |

```bash
pnpm --filter '@dafthunk/api' deploy
pnpm --filter '@dafthunk/app' deploy
pnpm --filter '@dafthunk/www' deploy

DATABASE_URL="postgresql://..." pnpm --filter '@dafthunk/api' db:migrate
```

---

## 关于本仓库

本仓库的代码修改主要借助 [Cursor](https://cursor.com) 完成。

邀请注册：[https://cursor.com/referral?code=YEZHVO8BJCNH](https://cursor.com/referral?code=YEZHVO8BJCNH)

欢迎基于上文 Docker 本地开发流程提交 PR。
