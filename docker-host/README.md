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

## 大陆访问 / 静态资源加速

首屏 JS 慢通常是**跨境传输**问题（301KB 不应需数分钟），与业务代码体积关系不大。当前链路：

`浏览器 → Caddy (TLS/H2) → nginx (gzip) → Vite dist`

已在 nginx / Caddy 默认开启：

- `/assets/*` 长缓存（`immutable`，哈希文件名）
- gzip 压缩等级 6 + `gzip_vary`
- Caddy 边缘 `encode gzip zstd`，禁用 HTTP/3（大陆部分线路 UDP/QUIC 会拖慢后再回退 H2）

**首次访问**要明显变快，需要把静态资源放到离用户更近的边缘：

| 方案 | 适用 | 做法 |
|------|------|------|
| **Cloudflare 橙云** | 已有 CF DNS | A 记录开代理；Page Rule / Cache Rule 缓存 `/assets/*` |
| **腾讯云 CDN** | 机器在腾讯云 | 源站填 `z3cz.com`，缓存 `/assets/`；大陆节点回源新加坡 |
| **香港源站** | 自管 VPS | 比新加坡到大陆 RTT 更低，TCP 吞吐更好 |

部署后更新 Caddy 配置：

```bash
cd /var/dafthunk/docker-host && ./launcher render && ./launcher recreate caddy
# nginx 配置随 app 容器挂载，需 rebuild：
sudo bash /var/dafthunk/scripts/host/deploy.sh
```

诊断（在**大陆客户端**执行，不要在 VPS 上）：

```bash
curl -w "ttfb:%{time_starttransfer} total:%{time_total} speed:%{speed_download}\n" \
  -H "Accept-Encoding: gzip" -o NUL -sS "https://你的域名/assets/index-*.js"
```

若 VPS 上 curl 很快、大陆很慢，说明是传输路径问题，应上 CDN 或换更近区域，而非继续减 JS。

## 布局

| 路径 | 说明 |
|------|------|
| `containers/app.yml` | configure 生成 |
| `shared/caddy/certs/<域名>/` | `fullchain.pem` + `privkey.pem` |
| `../scripts/host/` | bootstrap / configure / **https-setup** / deploy / https-* |
