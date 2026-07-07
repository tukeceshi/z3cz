# Dafthunk 营销站

基于 React Router v7 构建，部署于 Cloudflare Workers。

## 开发

本地开发统一使用 Docker，见仓库根目录 [README.md](../README.md)。

容器启动后访问 http://localhost:3100。

如需在宿主机直接运行（需 Node 20.19+ / pnpm 10.3+）：

```bash
cp .dev.vars.example .dev.vars
pnpm dev
```

## 部署

### 构建时环境变量

在 Cloudflare Dashboard 中配置：

**Workers & Pages → 对应 Worker → Settings → Build → Build variables and secrets**

| 变量 | 说明 |
|------|------|
| `VITE_API_HOST` | API 地址（如 `https://api.dafthunk.com`） |
| `VITE_APP_URL` | 应用地址（如 `https://app.dafthunk.com`） |
| `VITE_WEBSITE_URL` | 网站地址（如 `https://www.dafthunk.com`） |
| `VITE_CONTACT_EMAIL` | 联系邮箱 |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 ID（可选） |

这些变量在构建时注入，不写入代码仓库。

### 部署命令

```bash
pnpm deploy
```

## Google Analytics

采用 [Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced)：

- **默认**：拒绝所有追踪，直至用户同意
- **横幅**：首次访问时展示，用户可选择接受或拒绝
- **持久化**：选择结果保存至 localStorage

设置 `VITE_GA_MEASUREMENT_ID` 启用；留空则完全不加载分析脚本与横幅。
