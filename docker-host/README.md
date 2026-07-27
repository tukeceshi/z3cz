# Docker self-host (Discourse-style)

单域名 · Caddy · monorepo 旁路栈（`name: dafthunk-host`）。

**须通过 `https://你的域名` 访问**（HTTP 不支持登录与 AI 上传）。

## 安装（四步）

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/dafthunk/main/bootstrap-install" | sudo bash

sudo bash /var/dafthunk/scripts/host/configure.sh

sudo bash /var/dafthunk/scripts/host/https-setup.sh

sudo bash /var/dafthunk/scripts/host/deploy.sh
# 后台：sudo /var/dafthunk/scripts/host/deploy.sh --detach
```

`https-setup.sh` 在 deploy 前用 acme.sh 申请证书（LE → ZeroSSL），写入 `shared/caddy/certs/<域名>/`，并设 `tls: fallback`。

跳过预申请：`sudo bash .../https-setup.sh --caddy-only`（Caddy 在 deploy 后自行申请，可能遇 LE 限流）。

## 更新

```bash
sudo bash /var/dafthunk/scripts/host/update.sh
```

## 应急

| 情况 | 命令 |
|------|------|
| HTTPS 未就绪 | `sudo bash scripts/host/https-setup.sh` |
| 仅 ZeroSSL | `sudo bash scripts/host/https-fallback.sh` |
| 换证后生效 | `sudo bash scripts/host/https-reload.sh` |

## HTTPS 模式

| 模式 | 说明 |
|------|------|
| `auto` | configure 默认；setup 成功后会变为 `fallback` |
| `fallback` | 读 `shared/caddy/certs/<域名>/` |
| `manual` | 上传 pem，`tls: manual`，`https-reload.sh` |

## 布局

| 路径 | 说明 |
|------|------|
| `containers/app.yml` | configure 生成 |
| `shared/caddy/certs/<域名>/` | `fullchain.pem` + `privkey.pem` |
| `../scripts/host/` | bootstrap / configure / **https-setup** / deploy / https-* |
