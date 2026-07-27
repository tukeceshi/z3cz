# Dafthunk

> Break it, fix it, prompt it, automatic, automatic, ...

可视化工作流自动化平台：浏览器内编排与执行工作流（[React Flow](https://reactflow.dev/)）。自托管与本地开发用 **Docker + Node API + Postgres**；也可部署到 Cloudflare Workers。

![Workflow](./images/workflow.png)

## 概览

**功能**：可视化编排、AI 节点、HTTP / 邮件 / 队列等触发、组织级多租户。

**技术栈**：pnpm monorepo · TypeScript · Hono · React 19 · React Router v7 · Vite · Drizzle · Vitest · Docker ·（可选）Cloudflare Workers / R2 / Hyperdrive。

---

## 快速开始

### 自托管部署

面向 Linux 服务器，与下方「本地开发」相互独立。

#### 要求

- Linux（推荐 Ubuntu）、sudo、可访问外网
- 建议内存 + swap 合计约 4G

#### 安装（四步）

```bash
# 1. 环境 + 拉代码（整行复制）
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/bootstrap-install" | sudo bash

# 2. 写域名配置（交互时可省略 DAFTHUNK_HOSTNAME；始终启用 HTTPS）
sudo bash /var/dafthunk/scripts/host/configure.sh

# 3. 申请 HTTPS 证书（LE → ZeroSSL；成功写入统一目录，tls: fallback）
sudo bash /var/dafthunk/scripts/host/https-setup.sh

# 4. 构建并启动（较慢；后台：加 --detach）
sudo bash /var/dafthunk/scripts/host/deploy.sh
```

跳过预申请、交给 Caddy 自动办证：`sudo bash .../https-setup.sh --caddy-only`（LE 限流时 HTTPS 可能仍不可用）。

若第 2 步报 `command not found`，先下载再执行：

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/scripts/host/configure.sh" -o "/tmp/configure.sh" && sudo bash "/tmp/configure.sh"
```

若不用管道，第 1 步可用（**必须整行一条**）：

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/scripts/host/bootstrap.sh" -o "/tmp/bootstrap.sh" && sudo bash "/tmp/bootstrap.sh"
```

请在 **Linux 服务器的 bash** 里执行，不要用 Windows PowerShell 的 `curl`。

日志：`/var/dafthunk/rebuild.log`。后台构建时：`tmux attach -t dafthunk-deploy`。

默认目录 `/var/dafthunk`。**须通过 `https://你的域名` 访问**（HTTP 不支持登录与 AI 上传）。打开站点注册；**首个用户**为平台管理员。

#### 更新

`/var/dafthunk` 由 bootstrap 以 **root** 克隆，请用 **sudo** 拉代码（不要用 `git config safe.directory`）：

```bash
# 推荐：一条命令
sudo bash /var/dafthunk/scripts/host/update.sh

# 或分步
cd /var/dafthunk && sudo git pull && sudo bash scripts/host/deploy.sh
```

若已用普通用户执行 `git pull` 报 `dubious ownership`，改用上面命令即可。

#### 应急

| 情况 | 命令 |
|------|------|
| 构建日志 | `less /var/dafthunk/rebuild.log` |
| 后台构建 | `tmux attach -t dafthunk-deploy` |
| 只重构建 | `sudo bash /var/dafthunk/scripts/host/deploy.sh` |
| 改域名 | `sudo bash /var/dafthunk/scripts/host/configure.sh --force`，再 deploy |
| HTTPS 未就绪 | `sudo bash /var/dafthunk/scripts/host/https-setup.sh` 或 `https-fallback.sh` |
| 换证后生效 | `sudo bash /var/dafthunk/scripts/host/https-reload.sh` |
| 查看 Caddy 日志 | `sudo docker logs dafthunk-host-caddy-1 2>&1 \| tail -30` |
| 手动配置 | `cd /var/dafthunk/docker-host && ./dafthunk-setup` |

默认 Caddy 自动申请（`tls: auto`）。deploy 失败时仅引导备用申请；备用仍失败见下方手动模式。

#### HTTPS 模式

| 模式 | `tls` | 说明 |
|------|-------|------|
| 自动 | `auto` | configure 默认；**https-setup** 会预申请并改为 `fallback`（推荐） |
| 备用 | `fallback` | acme.sh 证书文件；续期先试回 Caddy |
| 手动 | `manual` | 自行上传文件，不自动续期 |

**安装顺序**：`configure` → **`https-setup`** → `deploy`。第三步失败时不要 deploy，按提示上传证书或重试。

**文件路径**（`fallback` / `manual` 相同）：

```
/var/dafthunk/docker-host/shared/caddy/certs/<域名>/fullchain.pem
/var/dafthunk/docker-host/shared/caddy/certs/<域名>/privkey.pem
```

#### 手动模式（用户自行操作，不在 deploy 引导中）

1. 上传上述两个文件（覆盖即可）
2. 编辑 `docker-host/containers/app.yml`：`tls: manual`
3. 生效：`sudo bash /var/dafthunk/scripts/host/https-reload.sh`

换证：覆盖 pem → 再跑 `https-reload.sh`。

切回自动：`sudo bash /var/dafthunk/scripts/host/https-try-auto.sh`

Caddy 已成功时自愿改手动：同上 1–3 步（自备证书文件）。

#### HTTPS 要求

自托管生产环境 **必须 HTTPS**：Cookie 与浏览器 API（如 `crypto.randomUUID`）仅在安全上下文中可用。请勿使用 HTTP 访问或 `--http` 模式。

---

### 本地开发

多端口开发栈（`:3100` / `:3101` / `:3102`），与自托管 compose 项目隔离。

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

四步安装与更新见上文「快速开始 → 自托管部署」。`scripts/host/` 下脚本：

| 脚本 | 作用 |
|------|------|
| `bootstrap.sh` | Docker / Git / 拉代码 |
| `configure.sh` | 写 `app.yml`（`--force` 覆盖；始终 HTTPS，`tls: auto`） |
| `https-setup.sh` | **第 3 步**：预申请证书（LE → ZeroSSL） |
| `deploy.sh` | 构建并启动（`--detach` 后台） |
| `update.sh` | `git pull` + deploy（需 sudo） |
| `https-fallback.sh` | Caddy 失败后的备用申请（deploy 提示） |
| `https-reload.sh` | 换文件或改 `tls` 后重启 Caddy |
| `https-try-auto.sh` | 自愿切回 Caddy 自动（用户自行） |

单域名 + Caddy，与开发栈隔离。详见 [docker-host/README.md](./docker-host/README.md)。

**手动配置（非 scripts/host）：** `cd docker-host && ./dafthunk-setup`（写配置后自动 rebuild）。

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
