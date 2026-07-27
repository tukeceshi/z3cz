# Docker self-host (Discourse-style)

单域名 · Caddy · monorepo 旁路栈（`name: dafthunk-host`）。

宿主机只需 **Docker + Git + bash**。`./launcher` 在无 Node 时用临时 Node 容器生成 compose。

**须通过 `https://你的域名` 访问**（HTTP 不支持登录与 AI 上传）。

## 安装（三步）

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/bootstrap-install" | sudo bash

sudo bash /var/dafthunk/scripts/host/configure.sh

sudo bash /var/dafthunk/scripts/host/deploy.sh
# 后台：sudo /var/dafthunk/scripts/host/deploy.sh --detach
```

默认 `/var/dafthunk`，`tls: auto`。日志：`rebuild.log`。

## 更新

```bash
sudo bash /var/dafthunk/scripts/host/update.sh
```

## 应急（deploy 引导范围）

| 情况 | 命令 |
|------|------|
| HTTPS 未就绪 | `sudo bash scripts/host/https-fallback.sh` |
| 构建中断 | `sudo scripts/host/deploy.sh` |

备用仍失败 → **手动模式**（见下），不在 deploy 脚本里自动切换。

## HTTPS 模式

| 模式 | `tls` | 续期 |
|------|-------|------|
| 自动 | `auto` | Caddy |
| 备用 | `fallback` | 先试回 Caddy，否则 acme.sh |
| 手动 | `manual` | 无（用户换文件 + reload） |

### 证书文件（fallback / manual 共用）

```
shared/caddy/certs/<域名>/fullchain.pem
shared/caddy/certs/<域名>/privkey.pem
```

Caddy 自动模式证书在 `shared/caddy/` 内部，不在上述路径。

### 手动模式

1. 上传两个 pem 到上路径
2. `containers/app.yml` 设 `tls: manual`
3. `sudo bash scripts/host/https-reload.sh`

换证：覆盖 pem → `https-reload.sh`。

### 用户自行（不进 deploy）

| 操作 | 命令 |
|------|------|
| 切回 Caddy 自动 | `sudo bash scripts/host/https-try-auto.sh` |
| 换证 / 改 tls 后生效 | `sudo bash scripts/host/https-reload.sh` |

## 常用命令

```bash
./launcher status
./launcher logs -f caddy
./launcher rebuild
```

## 布局

| 路径 | 说明 |
|------|------|
| `containers/app.yml` | `tls: auto \| fallback \| manual` |
| `shared/caddy/certs/` | fallback / manual 证书文件 |
| `../scripts/host/` | bootstrap / configure / deploy / https-* |

两套 compose（开发 / 自托管）数据不共享。
