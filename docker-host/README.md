# Docker self-host (Discourse-style)

单域名 · Caddy · 无 SMTP · monorepo 内旁路栈（`name: dafthunk-host`，与开发 `docker compose` 隔离）。

宿主机只需 **Docker + Git + bash**（无需本机 Node）。`./launcher` 在无 Node 时会用临时 Node 容器生成 compose。

- 控制台：`/`
- 营销站：`/m/`（app 容器 nginx 反代 www）
- Admin「首页」开关控制 `/` 跳控制台或 `/m/`

## 一键安装（Linux 服务器）

建议（可选）先更新系统，再一键安装：

```bash
sudo apt-get update && sudo apt-get upgrade -y   # 可选；耗时长，建议 tmux/screen
wget -qO- https://raw.githubusercontent.com/tukeceshi/dafthunk/main/install-dafthunk | sudo bash
```

推荐 Ubuntu。一键脚本会：

1. 选择提示语言（默认中文；`--lang en` / `DAFTHUNK_LANG=en`）  
2. 内存检查：达标直接通过；不足则询问 swap（默认 2G，可选 2～4 / `0` 跳过）  
3. 显示当前时区，默认保持；可选修改  
4. `apt update` 并安装 `docker.io` + Compose + `git`（不含 `apt upgrade`）  
5. clone → setup → 串行 `launcher rebuild`

目录默认 `/var/dafthunk`。日志：`/var/dafthunk/install.log`。选项：`--lang`、`--resume`、`--skip-swap`、`--force-setup`。SSH 下 `wget|bash` 经 `/dev/tty` 交互（提示会进日志）；apt 装完 Docker 后的服务重启提示可忽略。rebuild 默认进 tmux 后台，必要时 `tmux attach -t dafthunk-install`。

## 更新

```bash
cd /var/dafthunk && git pull && docker-host/launcher rebuild
```

## 应急（卡死 / SSH 断开）

| 情况 | 命令 |
|------|------|
| 构建中断 | `cd /var/dafthunk/docker-host && ./launcher rebuild` 或 `tmux attach -t dafthunk-install` |
| 无 app.yml | `./dafthunk-setup` |
| 接着跑安装器 | `sudo bash /var/dafthunk/install-dafthunk --resume` |
| 重配 hostname | `sudo bash /var/dafthunk/install-dafthunk --resume --force-setup` |
| 日志 | `less /var/dafthunk/install.log` |
| 失败备份 | `/var/dafthunk.backup.*` 确认无用后可删 |

`--resume`：跳过装 Docker/Git；已有 `containers/app.yml` 则跳过向导直接 rebuild。`shared/` 默认保留。

## 首次安装（已有仓库）

```bash
cd docker-host
./dafthunk-setup
```

写完 `containers/app.yml` 后会自动 `./launcher rebuild`。仅生成配置：`./dafthunk-setup --no-rebuild`。

浏览器打开打印的 URL，**注册第一个用户** → 自动成为 platform admin。

本地默认（hostname=`localhost`）为 HTTP，端口 **8080**。

## 常用命令

```bash
./launcher status
./launcher logs -f api
./launcher stop
./launcher rebuild    # 升级见上方「更新」；若缺 app.yml 会转入 setup
./launcher destroy    # 删容器，保留 shared/ 数据
```

Windows：优先 Git Bash 跑上述命令；或 `launcher.cmd rebuild` / `pnpm host:*`（无 bash 时回退 Node）。

## 布局

| 路径 | 说明 |
|------|------|
| `samples/standalone.yml` | 配置模板 |
| `containers/app.yml` | setup 生成（gitignore） |
| `shared/` | Postgres / 对象存储 / Caddy 数据 |
| `docker-compose.generated.yml` | launcher 生成，勿手改 |
| `dafthunk-setup` / `launcher` | bash 入口（主推） |
| `*.mjs` | 渲染逻辑与无 bash 时的回退 |

## 与开发栈

- 开发：根目录 `docker compose up` → `:3100` / `:3101` / `:3102`
- 可选同源网关：`VITE_WS_VIA_PROXY=1 docker compose --profile gateway up -d` → `http://localhost:8080`
- 自托管：本目录 launcher → 默认 `:80`/`:443` 或本地 `:8080`

两套 compose project 不同，数据卷不共享，可同机并行（注意端口）。
