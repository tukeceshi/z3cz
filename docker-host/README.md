# Docker self-host (Discourse-style)

单域名 · Caddy · monorepo 旁路栈（`name: dafthunk-host`）。

宿主机只需 **Docker + Git + bash**。`./launcher` 在无 Node 时用临时 Node 容器生成 compose。

## 安装（三步）

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/bootstrap-install" | sudo bash

sudo DAFTHUNK_HOSTNAME=你的域名 /var/dafthunk/scripts/host/configure.sh

sudo /var/dafthunk/scripts/host/deploy.sh
# 后台：sudo /var/dafthunk/scripts/host/deploy.sh --detach
```

默认 `/var/dafthunk`。日志：`rebuild.log`。后台：`tmux attach -t dafthunk-deploy`。

## 更新

```bash
cd /var/dafthunk && git pull && sudo scripts/host/deploy.sh
```

## 应急

| 情况 | 命令 |
|------|------|
| 构建中断 | `sudo scripts/host/deploy.sh` 或 `tmux attach -t dafthunk-deploy` |
| 改域名 | `sudo scripts/host/configure.sh --force` 再 deploy |
| 无 app.yml | `./dafthunk-setup` |
| 日志 | `less /var/dafthunk/rebuild.log` |

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
| `shared/` | Postgres / 存储 / Caddy |
| `../scripts/host/` | bootstrap / configure / deploy |

## 与开发栈

- 开发：根目录 `docker compose up` → `:3100` / `:3101` / `:3102`
- 自托管：launcher → `:80` / `:443`

两套 compose 数据不共享。
