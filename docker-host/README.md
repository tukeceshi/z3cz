# Docker self-host (Discourse-style)

单域名 · Caddy · monorepo 旁路栈（`name: dafthunk-host`）。

宿主机只需 **Docker + Git + bash**。`./launcher` 在无 Node 时用临时 Node 容器生成 compose。

## 安装（三步）

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/bootstrap-install" | sudo bash

sudo bash /var/dafthunk/scripts/host/configure.sh

# 仅 HTTP（可选）
sudo bash /var/dafthunk/scripts/host/configure.sh --http

sudo bash /var/dafthunk/scripts/host/deploy.sh
# 后台：sudo /var/dafthunk/scripts/host/deploy.sh --detach
```

默认 `/var/dafthunk`。日志：`rebuild.log`。后台：`tmux attach -t dafthunk-deploy`。

## 更新

```bash
cd /var/dafthunk && git pull && sudo bash scripts/host/deploy.sh
```

## 应急

| 情况 | 命令 |
|------|------|
| 构建中断 | `sudo scripts/host/deploy.sh` 或 `tmux attach -t dafthunk-deploy` |
| HTTPS 失败 / LE 限流 | `sudo bash scripts/host/use-http.sh` |
| 重新申请 HTTPS 证书 | `sudo bash scripts/host/renew-https.sh` |
| 改域名 | `sudo scripts/host/configure.sh --force` 再 deploy |
| 无 app.yml | `./dafthunk-setup` |
| 日志 | `less /var/dafthunk/rebuild.log` |

## HTTP / HTTPS

| 目的 | 命令 |
|------|------|
| 首次安装即 HTTP | `sudo bash scripts/host/configure.sh --http` |
| 运行中切 HTTP | `sudo bash scripts/host/use-http.sh` |
| 删旧证、重开 HTTPS | `sudo bash scripts/host/renew-https.sh` |

`use-http.sh` / `renew-https.sh` 会改 `containers/app.yml`、执行 `launcher render`，并重建 www/app（URL 写入前端镜像）。`renew-https.sh` 还会删除 `shared/caddy/caddy/certificates/` 并重建 caddy。

Let's Encrypt 7 天内同一域名申请次数有限；反复重装易触发限流。限流期间用 HTTP，解除后再 `renew-https.sh`。

## 已有仓库（手动）

```bash
cd docker-host && ./dafthunk-setup
```

## 常用命令

```bash
./launcher status
./launcher logs -f api
./launcher rebuild
./launcher destroy
```

## 布局

| 路径 | 说明 |
|------|------|
| `containers/app.yml` | configure / setup 生成 |
| `shared/` | Postgres / 存储 / Caddy（证书在 `shared/caddy/caddy/certificates/`） |
| `../scripts/host/` | bootstrap / configure / deploy / use-http / renew-https |

## 与开发栈

- 开发：根目录 `docker compose up` → `:3100` / `:3101` / `:3102`
- 自托管：launcher → `:80` / `:443`

两套 compose 数据不共享。
