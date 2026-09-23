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
- Docker Engine 24+ 与 Docker Compose v2
- 建议内存 6G+

#### 安装（一条命令）

```bash
installer="$(mktemp)" && curl -fL --connect-timeout 20 --max-time 120 "https://raw.githubusercontent.com/tukeceshi/z3cz/main/bootstrap-install" -o "$installer" && sudo bash "$installer"
```

安装器下载 `self-host` 测试渠道的部署包并校验 SHA-256。生产只运行 `api`、`postgres`、`caddy` 三个容器，使用固定版本的通用 Node、PostgreSQL、Caddy 镜像；不会构建、发布或拉取 z3cz 专用镜像，也不会在服务器构建 App 或编译 API。

安装时会询问公网域名。填写后由容器内 Caddy 自动申请并续期证书；直接回车，或当前没有终端时，监听 HTTP 80，不写站点地址。自动化安装跳过提问：

```bash
sudo Z3CZ_SITE_ADDRESS=example.com Z3CZ_PUBLIC_URL=https://example.com bash "$installer"
```

未同时给出 `Z3CZ_PUBLIC_URL` 时，站点地址写为 `https://<域名>`。

程序安装到 `/opt/z3cz/releases/<版本>`，`current`/`previous` 为原子版本指针；配置位于 `/etc/z3cz`，PostgreSQL、上传、Caddy 数据与备份位于 `/var/lib/z3cz`，pnpm store 位于 `/var/cache/z3cz/pnpm`。每个版本的 API 生产依赖由一次性 Node 容器以 `--prod --frozen-lockfile` 安装并复用该缓存。

#### 更新

推荐在管理后台「系统设置 → 系统更新」选择 GitHub 或 Gitee 渠道并升级。后台负责版本检查、下载、SHA-256 校验和进度留痕；宿主机执行器只负责备份、迁移、原子切换、健康检查和失败回退。

也可以使用宿主机命令升级正式版本：

```bash
sudo bash /opt/z3cz/current/scripts/update.sh v1.0.12
```

更新只接受显式 `v*` 正式版本。下载、校验、解压和依赖安装在旧服务运行期间完成；随后进入维护、备份 PostgreSQL、以新版本 `dist/migrate.mjs` 迁移、原子切换并健康检查。应用失败会自动切回；不兼容迁移会保持维护状态并要求显式恢复备份。

`main` 分支只更新可变的 `self-host` 首装测试包；`v*` 标签生成不可变正式包。首次安装走上面的安装器，正式更新只走带版本号的 `update.sh`，两个渠道不会混用。

Release 与 CPU 架构无关，只含 App 静态产物、API 编译后 JS/迁移、独立生产依赖清单与锁文件、Compose/Caddy、运维脚本及版本策略文件；不含源码、Git 历史、`node_modules` 或开发依赖。

发布前维护根目录 `update-policy.json`：`minimumVersion` 限制可直接升级的最低版本；`requiresBackup` 要求本次创建新备份；`databaseChanges` 强制执行迁移；`minimumRollbackVersion` 和 `rollbackCompatible` 共同声明旧代码能否继续使用迁移后的数据。更新器仍会比较新旧数据库文件，历史不明确时按需要新备份、需要人工恢复处理。发布流程会校验该文件和更新协议。

旧部署不能直接覆盖升级。迁移时应先用 `pg_dump` 导出数据库并备份上传目录，再导入新布局。

#### HTTPS

自托管生产环境 **必须 HTTPS**：Cookie 与浏览器 API（如 `crypto.randomUUID`）仅在安全上下文中可用。安装时填写的域名必须已经解析到这台机器，并开放 TCP/UDP 80、443。证书未就绪时直接回车，先以 HTTP 初始化。

填写域名后由 Caddy 容器自动申请并续期证书。

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

下表仅列本地开发命令。生产 Compose 属于 Release，必须通过安装/更新脚本使用，不能从源码目录直接 `up --build`。

| 场景 | 命令 |
| --- | --- |
| 开发：构建并启动 | `docker compose up -d --build --wait` |
| 开发：使用已有镜像启动 | `docker compose up -d --wait` |
| 开发：查看状态 | `docker compose ps` |
| 开发：查看全部日志 | `docker compose logs -f` |
| 开发：查看 API / App 日志 | `docker compose logs -f api app` |
| 开发：停止 | `docker compose down` |
| 开发：完全重置数据 | `docker compose down -v` |

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
