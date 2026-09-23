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
installer="$(mktemp)" && curl -fL --connect-timeout 20 --max-time 120 "https://raw.githubusercontent.com/tukeceshi/z3cz/main/bootstrap-install" -o "$installer" && sudo bash "$installer"
```

安装器不使用 Docker 或 Docker 镜像。它会安装宿主机 PostgreSQL、Caddy，下载经过 SHA-256 校验的原生发布包，并通过 systemd 启动 API。当前支持 Ubuntu 22.04/24.04/26.04、Debian 12，以及 amd64/arm64。

安装期间可输入域名，也可直接回车跳过。输入域名时，Caddy 自动申请 HTTPS 证书；回车时系统以 `http://服务器公网IP` 进入初始化模式。之后可在 Admin 后台的“域名与 HTTPS”中绑定或更换域名、查看证书状态并重新签发。HTTP 初始化模式仅用于完成管理配置，正式业务建议在 HTTPS 启用后使用。

程序安装到 `/opt/z3cz/releases/<版本>`，`/opt/z3cz/current` 指向当前版本；配置位于 `/etc/z3cz`，数据库备份和上传文件位于 `/var/lib/z3cz`。服务器不会拉取源码或现场执行前端构建。

#### 更新

当前使用宿主机更新命令升级正式版本：

```bash
sudo bash /opt/z3cz/current/scripts/host/update.sh
sudo bash /opt/z3cz/current/scripts/host/update.sh v1.0.8
```

更新器会下载并校验原生发布包、创建 PostgreSQL 逻辑备份、执行迁移、原子切换版本并做健康检查。应用启动失败会切回旧版本；数据库发生不兼容迁移时保持维护模式并给出明确的恢复命令。

更新顺序为：下载与校验发布包 → 创建数据库备份 → 进入维护模式 → 安装并迁移 → 原子切换版本 → 健康检查。应用启动失败时自动切回上一版程序；为避免误伤数据，数据库恢复需要管理员执行脚本输出的 `pg_restore` 命令。

发布流程为 amd64、arm64 分别生成自包含安装包，内含固定版本 Node.js、API 生产依赖和前端静态资源，不再构建或推送 Docker 镜像。

发布前维护根目录 `update-policy.json`：`minimumVersion` 限制可直接升级的最低版本；`requiresBackup` 要求本次创建新备份；`databaseChanges` 强制执行迁移；`minimumRollbackVersion` 和 `rollbackCompatible` 共同声明旧代码能否继续使用迁移后的数据。更新器仍会比较新旧数据库文件，历史不明确时按需要新备份、需要人工恢复处理。发布流程会校验该文件和更新协议。

旧 Docker 安装不能直接覆盖升级为原生部署。迁移时应先使用 `pg_dump` 导出数据库，并备份上传目录，再在新原生安装中恢复；确认新服务正常后再停用旧容器。

#### HTTPS

自托管生产环境 **必须 HTTPS**：Cookie 与浏览器 API（如 `crypto.randomUUID`）仅在安全上下文中可用。请勿使用 HTTP 访问或 `--http` 模式。签发前确认域名已解析到 **正在申请证书的这台机器**（见上方安装步骤）。


输入域名后由宿主机 Caddy 自动申请并续期证书。域名必须提前解析到当前服务器，并开放 TCP 80、443 端口。Caddy 配置位于 `/etc/caddy/Caddyfile`。

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

开发与部署可同时运行：开发入口为 `http://localhost:3000`，命令部署入口为 `http://localhost:8080`。命令部署与一键部署均由 Caddy 转发 `/api` 到内部的 `api:3001`。

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

更新代码后，Docker 本地开发或命令部署重新执行对应的“构建并启动”命令即可；公开的一键自托管使用上文的原生发布包流程。

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
