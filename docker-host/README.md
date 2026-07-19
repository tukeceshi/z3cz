# Docker self-host (Discourse-style)

单域名 · Caddy · 无 SMTP · monorepo 内旁路栈（`name: dafthunk-host`，与开发 `docker compose` 隔离）。

## 首次安装

```bash
node docker-host/dafthunk-setup.mjs
node docker-host/launcher.mjs rebuild
```

浏览器打开 setup 打印的 URL，**注册第一个用户** → 自动成为 platform admin（无需在 setup 里填邮箱）。

本地默认（hostname=`localhost`）为 HTTP，端口 **8080**。

## 常用命令

```bash
node docker-host/launcher.mjs status
node docker-host/launcher.mjs logs -f api
node docker-host/launcher.mjs stop
node docker-host/launcher.mjs rebuild    # 升级：git pull 后执行
node docker-host/launcher.mjs destroy    # 删容器，保留 shared/ 数据
```

Windows 可用 `docker-host\launcher.cmd rebuild`。

## 布局

| 路径 | 说明 |
|------|------|
| `samples/standalone.yml` | 配置模板 |
| `containers/app.yml` | setup 生成（gitignore） |
| `shared/` | Postgres / 对象存储 / Caddy 数据 |
| `docker-compose.generated.yml` | launcher 生成，勿手改 |

## 与开发栈

- 开发：根目录 `docker compose up` → `:3100` / `:3101` / `:3102`
- 可选同源网关：`VITE_WS_VIA_PROXY=1 docker compose --profile gateway up -d` → `http://localhost:8080`
- 自托管：本目录 launcher → 默认 `:80`/`:443` 或本地 `:8080`

两套 compose project 不同，数据卷不共享，可同机并行（注意端口）。
