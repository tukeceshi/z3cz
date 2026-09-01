# 维护信息：WS 公共层方案

> 状态：已执行

## 目标

画布显示 = **工作流私有数据** + **全站公共数据**，经 WS 合并。

- 改节点 / prompt → 只动 workflow
- 改维护 → 只动 public（一份公共内存 + DB）
- 去掉画布页 15s 轮询 `/site-settings`

## 模型

```
init / 推送
  workflow  →  nodes, edges, viewport…（每个工作流一份，现有逻辑）
  public    →  maintenanceEnabled, message（全站一份）

前端 merge
  画布 ← workflow
  遮罩 ← public
```

存储已是两份，不合并进 `workflow.json`：

| 层 | 存储 |
|----|------|
| workflow | R2 `workflows/{id}/workflow.json` |
| public | DB `site_settings` |

## 协议（types）

### 1. 公共快照

```ts
interface WorkflowPublicState {
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
}
```

### 2. 改 init（或 init 后立即跟一条 public）

```ts
interface WorkflowInitMessage {
  type: "init";
  state: WorkflowState;
  public: WorkflowPublicState;  // 新增
}
```

### 3. 公共层变更推送（只带 public，不动 workflow）

```ts
interface WorkflowPublicMessage {
  type: "public";
  public: WorkflowPublicState;
}
```

`ServerMessage` 增加 `WorkflowPublicMessage`。

## 服务端

### 公共内存（单例）

- **Node**：`PlatformPublicState` 进程单例，启动 / 首次连接时从 DB 加载，admin 改完更新内存 + DB
- **Workers**：单实例 DO，或 DO 内缓存 + admin 时刷新（仍是一份）

### workflow WS 连接时

[`workflow-agent.ts`](apps/api/src/durable-objects/workflow-agent.ts) / [`node-workflow-session-hub.ts`](apps/api/src/runtime/node-workflow-session-hub.ts)：

- `init` 的 `state` 照旧
- 附带 `public`：读公共内存（ miss 则读 DB）

### admin 改维护时

[`admin/settings.ts`](apps/api/src/routes/admin/settings.ts) PATCH 成功：

1. 写 DB（已有）
2. 更新公共内存（一份）
3. **通知在线连接**：对所有 workflow session 发 `{ type: "public", public: … }`
   - Node：hub 遍历全部 session 的 clients
   - Workers：单例 DO 持有连接注册表，或 hub 模块统一广播

> 通知是「告诉客户端 public 变了」，不是给每个连接各存一份维护配置。

## 客户端

### [`workflow-session-service.ts`](apps/app/src/services/workflow-session-service.ts)

- `init`：解析 `public`，回调 `onPublic`
- 收 `public`：合并更新本地 public 缓存，回调 `onPublic`

### [`canvas-maintenance-context.tsx`](apps/app/src/contexts/canvas-maintenance-context.tsx)

- 删除 15s `setInterval`
- 首次 HTTP 拉 `/site-settings` 保留（WS 未连上前的兜底）
- 由 `useEditableWorkflow` / editor 把 `onPublic` 接到 context，更新遮罩与 `setCanvasMaintenanceFrozen`

### 合并显示

```ts
// workflow 变 → 只更新画布
// public 变 → 只更新遮罩，不动 nodes/edges
```

## 不在范围

- 首页维护页（[`maintenance-page.ts`](apps/app/maintenance-page.ts)）仍 HTTP
- 不把 maintenance 写入 R2 workflow.json
- 不新增第二条 Platform WS

## 涉及文件

| 文件 | 改动 |
|------|------|
| `packages/types` | `WorkflowPublicState`、`WorkflowPublicMessage`、扩展 `WorkflowInitMessage` |
| `apps/api` | 公共内存单例、init 带 public、admin 广播 `public` |
| `apps/app` | WS 收 public、`canvas-maintenance-context` 去轮询 |

## 验收

1. 连上 WS → `init.public` 正确，关维护无遮罩
2. 管理员开/关维护 → 已开画布 **立刻** 变遮罩，**workflow 内容不变**
3. 网络面板无 15s `/site-settings` 轮询
4. R2 workflow.json 不含 maintenance 字段

## 执行顺序

1. types
2. 服务端公共内存 + init.public
3. admin PATCH → broadcast `public`
4. 客户端接入 + 去轮询
5. 手动验收
