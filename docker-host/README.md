# z3cz · Docker 自托管

单域名 · Caddy · monorepo 旁路栈（Compose 项目名仍为 `dafthunk-host`）。

首次安装可不填域名：系统会以 HTTP 初始化模式启动；绑定域名并启用 HTTPS 后再使用完整业务功能。

## 安装（一条命令）

```bash
curl -fsSL "https://raw.githubusercontent.com/tukeceshi/z3cz/main/bootstrap-install" | sudo bash
```

安装器会优先检查 Docker 与 Docker Compose。Linux 上缺失 Docker 时会自动安装；Windows 用户请先安装并启动 Docker Desktop、启用 WSL2 Integration，再在 Ubuntu WSL 中执行同一条命令。请将安装目录放在 WSL Linux 文件系统中，而不是 `/mnt/c`。

### Windows（WSL2）

1. 安装并启动 Docker Desktop，切换到 Linux containers 模式。
2. 在 Docker Desktop 的 **Settings → Resources → WSL Integration** 中启用 Ubuntu。
3. 若尚未安装 Ubuntu WSL，在管理员 PowerShell 执行：

   ```powershell
   wsl --install -d Ubuntu
   ```

4. 打开 Ubuntu WSL 命令窗口：在开始菜单搜索 **Ubuntu** 并打开；或在 PowerShell 执行：

   ```powershell
   wsl -d Ubuntu
   ```

5. 在打开的 Ubuntu 窗口中执行本页的一键安装命令。不要在 PowerShell、Git Bash 或 `/mnt/c/...` 路径中部署。

安装脚本会验证 Docker Desktop 是否已通过 WSL 可用；检查失败时不会下载部署包或创建半成品容器。

域名为可选输入：填写后由 Caddy 自动申请证书；直接回车会以 HTTP 初始化模式启动。之后通过 Admin 后台的“域名与 HTTPS”绑定、更换域名并管理证书。HTTPS 自动续期由 Caddy 完成。

渲染配置用 Docker 跑 Node 镜像，系统不装 Node。bootstrap 会配 Docker 镜像加速；连不上 Docker Hub 时走加速源。api / app 镜像在 Docker Hub，更新时只拉有变化的层。

跳过预申请：`sudo bash .../https-setup.sh --caddy-only`（Caddy 在 deploy 后自行申请，可能遇 LE 限流）。

## 更新

管理后台 **系统设置 → 系统更新**。`deploy.sh` 会自动安装宿主机更新器。

```bash
sudo bash /var/dafthunk/scripts/host/deploy.sh
```

命令行：

```bash
sudo bash /var/dafthunk/scripts/host/update.sh

# 重置安装（清 DB / 上传，保留 app.yml 与证书）
sudo bash /var/dafthunk/scripts/host/update.sh --reset
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
# nginx 配置随 app 容器挂载，重新 deploy 即可：
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
