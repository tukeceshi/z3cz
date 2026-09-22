# z3cz

**开源可视化工作流与 AI 创作工作台**

独立维护项目，源码仓库：[github.com/tukeceshi/z3cz](https://github.com/tukeceshi/z3cz)。

[快速开始](#快速开始) · [核心功能](#核心功能) · [效果展示](#效果展示) · [项目结构](#项目结构) 

## 核心功能

- **无限画布**：节点拖拽、连线，画布 / 创作工作室双视图
- **AI 创作**：文本、图片、视频、音频
- **实时协同编辑**：WebSocket 多端同步画布，编辑防抖落库（Postgres）
- **创作视图**：编辑节点拥有更宽阔的操作空间与更便捷的交互体验
- **AI模型接口**：原生支持主流模型，可更换url和模型ID用于兼容中转
- **火山引擎深度接入**：使用AK/SK用户凭证，自动导入AI接口、资源包消耗情况
- **生成媒体落库**：结果上传云存储；画布暂存管理，减少资源重复加载
- **生成任务守护**：Generation Job（生成任务）持久化，刷新或离开后可继续跟进

## 效果展示

| 画布 | 创作视图 |
| --- | --- |
| <img src="docs/images/canvas-light.png" alt="画布 · 浅色" width="100%" /> | <img src="docs/images/creation-view.png" alt="创作视图" width="100%" /> |
| <img src="docs/images/canvas-dark.png" alt="画布 · 深色" width="100%" /> | <img src="docs/images/ai-interface.png" alt="AI 接口配置" width="100%" /> |
| <img src="docs/images/wizard-channel.png" alt="接入向导 · 选渠道" width="100%" /> | <img src="docs/images/wizard-models.png" alt="接入向导 · 选模型" width="100%" /> |


---

## 快速开始

### 自托管部署

面向 Linux 服务器，与下方「本地开发」相互独立。

#### 要求

- Linux（推荐 Ubuntu）
- 内存 6G + （不足时自动 swap 增加虚拟内存）

#### 安装（一条命令）

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/z3cz/main/bootstrap-install" | sudo bash
```

安装器首先检查 Docker 与 Docker Compose；普通 Linux 缺失 Docker 时会安装，WSL 中不会安装 Docker，而是要求先在 Windows 安装并启动 Docker Desktop，并启用当前发行版的 WSL Integration。

安装期间可输入域名，也可直接回车跳过。输入域名时，Caddy 自动申请 HTTPS 证书；回车时系统以 `http://服务器公网IP` 进入初始化模式。之后可在 Admin 后台的“域名与 HTTPS”中绑定或更换域名、查看证书状态并重新签发。HTTP 初始化模式仅用于完成管理配置，正式业务建议在 HTTPS 启用后使用。

#### Windows（Docker Desktop + WSL2）

Windows 不使用 PowerShell 原生部署。请先自行安装并启动 Docker Desktop，然后在 **Settings → Resources → WSL Integration** 中为 Ubuntu 启用集成；Docker Desktop 必须处于 Linux containers 模式。

在 PowerShell 安装 WSL 与 Ubuntu（已安装可跳过）：

```powershell
wsl --install -d Ubuntu
```

重启并打开 Ubuntu 后，在 WSL 的 Linux 文件系统中执行同一条安装命令：

- 在开始菜单搜索并打开 **Ubuntu**；或
- 打开 PowerShell，执行 `wsl -d Ubuntu`。

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/z3cz/main/bootstrap-install" | sudo bash
```

部署数据默认写入 `/var/dafthunk`。请勿在 `/mnt/c/...` 等 Windows 挂载路径中部署或保存运行数据，以避免 Docker 文件权限和 I/O 问题。若脚本提示 Docker Desktop 不可用，请确认 Docker Desktop 已启动且已为当前 Ubuntu 发行版启用 WSL Integration。

首次安装下载轻量部署包，再拉取发布时已构建好的版本化 API/App 镜像；服务器不构建应用源码。运行中的容器始终使用已完成的镜像。

#### 更新

管理后台 **系统设置 → 系统更新**：检查正式版本、一键升级、失败回退。

`deploy.sh` 自动安装宿主机更新器。旧版 `SOURCE_REVISION` 源码部署包不能用于新的首装流程；请使用当前发布的镜像部署包。

普通更新：增量获取源码、复用缓存构建镜像 → 校验近期备份 → 短暂暂停访问、切换应用 → 验证并恢复访问。没有可用的近期备份时会创建一份。数据库文件一致时跳过迁移。准备期间原服务继续运行。

数据库更新或无法确认兼容性的旧部署：准备完成后进入维护模式 → 按版本要求创建或复用备份 → 迁移 → 切换并验证。迁移未完成或新旧数据库不兼容时保持维护状态，由管理员明确执行备份恢复；已声明兼容的迁移可以只回退应用镜像并保留数据。

关闭网页不影响更新；短暂断线会自动重连。更新器重启后，准备阶段中断可重试，切换阶段中断会提示使用回退恢复，不会自动重复执行迁移。

基础环境由 `docker/Dockerfile.source` 决定，仅该文件变化时发布新的 `tukeceshi/z3cz-runtime` 镜像。`docker/Dockerfile.update` 把应用代码装入本机镜像。更新器只清理属于当前安装、且不再用于运行或回退的旧镜像；备份与用户文件不自动删除。

发布前维护根目录 `update-policy.json`：`minimumVersion` 限制可直接升级的最低版本；`requiresBackup` 要求本次创建新备份；`databaseChanges` 强制执行迁移；`minimumRollbackVersion` 和 `rollbackCompatible` 共同声明旧代码能否继续使用迁移后的数据。更新器仍会比较新旧数据库文件，历史不明确时按需要新备份、需要人工恢复处理。发布流程会校验该文件和更新协议。

启用本次优化需先通过新版部署包安装宿主机更新器；仅更新应用代码不会替换已经安装的更新器二进制。

命令行备用：

```bash
sudo bash /var/dafthunk/scripts/host/update.sh
sudo bash /var/dafthunk/scripts/host/update.sh v1.0.5

# 重置安装：清 DB 与上传，保留域名配置与证书
sudo bash /var/dafthunk/scripts/host/update.sh --reset
```

发布需要配置 GitHub Secrets `DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`，并允许推送 `tukeceshi/z3cz-runtime`。正常版本发布复用已有基础环境。服务器须能访问 GitHub、依赖仓库和首次安装所需的镜像源。后台系统更新可选择 GitHub 或 Gitee 拉取源码；检查新版本仍使用 GitHub。

#### HTTPS 模式

自托管生产环境 **必须 HTTPS**：Cookie 与浏览器 API（如 `crypto.randomUUID`）仅在安全上下文中可用。请勿使用 HTTP 访问或 `--http` 模式。签发前确认域名已解析到 **正在申请证书的这台机器**（见上方安装步骤）。


| 模式  | `tls`      | 说明                                                  |
| --- | ---------- | --------------------------------------------------- |
| 自动  | `auto`     | configure 默认；**https-setup** 会预申请并改为 `fallback`（推荐） |
| 备用  | `fallback` | acme.sh 证书文件；续期重载 Caddy                              |
| 手动  | `manual`   | 自行上传文件，不自动续期                                        |


**文件路径**（`fallback` / `manual` 相同）：

```
/var/dafthunk/docker-host/shared/caddy/certs/<域名>/fullchain.pem
/var/dafthunk/docker-host/shared/caddy/certs/<域名>/privkey.pem
```

#### 手动上传证书（按需，不是必要步骤）

1. 上传上述两个文件（覆盖即可）
2. 编辑 `docker-host/containers/app.yml`：`tls: manual`
3. 生效：`sudo bash /var/dafthunk/scripts/host/https-reload.sh`

切回自动：`sudo bash /var/dafthunk/scripts/host/https-try-auto.sh`

---

### 本地开发

#### 前置要求

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2.1+（需支持 `up --wait`）

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
git clone https://github.com/tukeceshi/z3cz.git
cd z3cz
docker compose up -d --build --wait
```

国内访问 Docker Hub 容易超时（报错含 `registry-1.docker.io`）。可在 Docker Desktop → **Settings → Docker Engine** 配置镜像加速，一次生效、无需改项目里的镜像名：

```json
"registry-mirrors": ["你的加速地址"]
```

加速地址从 [阿里云](https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors) 或 [腾讯云](https://cloud.tencent.com/document/product/1207/45596) 控制台获取（登录后复制，每人不同）。保存并重启 Docker 后，再执行 `docker compose up -d --build --wait`。

默认不必复制环境文件；容器会生成 `apps/api/.dev.vars`。改端口或 Cloudflare 等时，再从对应 `.example` 复制后编辑。

首次 API 约 **30–90 秒**就绪（密钥卷、迁移、按服务隔离的 `node_modules`）。


| 地址                                             | 服务                               |
| ---------------------------------------------- | -------------------------------- |
| [http://localhost:3000](http://localhost:3000) | 产品 app（`/api` 经 Caddy 反代至 API） |


请用 **3000** 使用产品。API 仅在 Docker 网络内以 `http://api:3001` 提供服务；浏览器通过同源的 `/api` 访问它。

#### 更新

```bash
git pull
docker compose up -d --build --wait
```

`origin` 连不上时：

```bash
git pull --progress https://ghfast.top/https://github.com/tukeceshi/z3cz.git main
docker compose up -d --build --wait
```

#### 登录

1. 打开 [http://localhost:3000/login](http://localhost:3000/login)
2. 邮箱 + 密码「登录 / 注册」
3. **首个注册用户**为超级管理员

---

## Docker 命令总览

开发与部署可同时运行：开发入口为 `http://localhost:3000`，部署入口为 `http://localhost:8080`。两套 API 都只在各自 Docker 网络内的 `api:3001` 提供服务，不发布宿主机端口。

| 场景 | 命令 |
| --- | --- |
| 开发：构建并启动 | `docker compose up -d --build --wait` |
| 开发：使用已有镜像启动 | `docker compose up -d --wait` |
| 开发：查看状态 | `docker compose ps` |
| 开发：查看全部日志 | `docker compose logs -f` |
| 开发：查看 API / App 日志 | `docker compose logs -f api app` |
| 开发：停止 | `docker compose down` |
| 开发：完全重置数据 | `docker compose down -v` |
| 部署：构建并启动 | `docker compose -f docker-compose.prod.yml up -d --build --wait` |
| 部署：查看状态 | `docker compose -f docker-compose.prod.yml ps` |
| 部署：查看日志 | `docker compose -f docker-compose.prod.yml logs -f` |
| 部署：停止 | `docker compose -f docker-compose.prod.yml down` |

部署首次启动时，API 会在持久 Docker 卷 `z3cz-prod_dafthunk_prod_secrets` 中自动生成密钥；后续启动会复用。部署环境也不要使用 `down -v`，否则密钥、数据库和上传文件都会被删除。

更新代码后，开发或部署均重新执行对应的“构建并启动”命令即可。`docker-compose.prod.yml` 仍为旧版过渡方案；新的公开自托管部署请使用上文自托管流程。

---

## 项目结构

```
apps/api/            Hono API（本地 Node / 可选 Workers）
apps/app/            产品 UI（React + Vite）
packages/types/      共享类型
packages/utils/      共享工具
packages/runtime/    工作流节点运行时
docker-host/         自托管 launcher / setup（Caddy 单域名）
docker/              开发 entrypoint、Nginx、Caddyfile.dev
```

---

## Cloudflare部署（未验证，本地化改动太大了）

可用 GitHub Actions 将主分支部署为 Workers（API / app），库用 Supabase + Hyperdrive，对象用 R2。

```bash
echo "ACCOUNT_ID" | pnpm wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
echo "API_TOKEN"  | pnpm wrangler secret put CLOUDFLARE_API_TOKEN --env production
echo "R2_KEY"     | pnpm wrangler secret put R2_ACCESS_KEY_ID --env production
echo "R2_SECRET"  | pnpm wrangler secret put R2_SECRET_ACCESS_KEY --env production
```


| 构建变量                     | 说明      |
| ------------------------ | ------- |
| `VITE_API_HOST`          | API 地址  |
| `VITE_APP_URL`           | 应用地址    |
| `VITE_WEBSITE_URL`       | 站点地址    |
| `VITE_CONTACT_EMAIL`     | 联系邮箱    |
| `VITE_GA_MEASUREMENT_ID` | GA4（可选） |


```bash
pnpm --filter '@dafthunk/api' deploy
pnpm --filter '@dafthunk/app' deploy

DATABASE_URL="postgresql://..." pnpm --filter '@dafthunk/api' db:migrate
```

---

## 关于本仓库

本仓库的代码修改主要借助 [Cursor](https://cursor.com) 完成。

欢迎基于上文 Docker 本地开发流程提交 PR。
