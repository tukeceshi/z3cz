# 本地开发测试临时文件

一次性调试产物（curl cookie、登录 JSON、API 探测输出、一次性 probe 脚本等）请放在：

```
.local/dev-test/
├── auth/            # 登录凭据、Netscape cookie 文件
├── probe-output/    # API 探测输出 dump
├── agent-tools/     # TOS 定价等本地抓取脚本与数据
└── probe-scripts/   # 一次性火山/billing 探测脚本（tsx 手动运行）
```

该目录已在 `.gitignore` 中通过 `.local/` 规则排除，**不会进入版本库**。

仍在仓库内的正式 probe 脚本（供 skill 引用）：

- `apps/api/scripts/probe-billing-catalog-map.ts`
- `apps/api/scripts/probe-glm-chat.ts`

已归档至 `.local/dev-test/probe-scripts/` 的脚本，从 `apps/api` 运行示例：

```bash
cd apps/api
pnpm exec tsx ../../.local/dev-test/probe-scripts/probe-billing-full-list.ts
```
