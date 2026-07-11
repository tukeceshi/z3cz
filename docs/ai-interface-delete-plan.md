# 组织 AI 接口删除方案

> 日期：2026-07-11  
> 状态：**Phase 1 已实现**（2026-07-11）  
> 关联：[volcano-resource-packages-migration-plan.md](./volcano-resource-packages-migration-plan.md)

---

## 1. 背景与目标

组织可在「AI 接口」页配置火山方舟等上游连接。用户需要能**删除不再使用的接口实例**，并清楚删除后果。

**目标：**

1. 火山方舟卡片与 Legacy 表格**均可删除**
2. 删除前明确提示（含工作流影响、凭据说明）
3. API 行为可预期（404、默认接口处理）
4. 不破坏现有工作流图数据（与方案删除策略一致）

---

## 2. 现状盘点

### 2.1 已有能力

| 层级 | 状态 | 说明 |
|------|------|------|
| API | ✅ 已有 | `DELETE /:organizationId/ai-interfaces/:id` |
| DB 查询 | ✅ 已有 | `deleteOrganizationAiInterface` 硬删除行 |
| 前端 Service | ✅ 已有 | `deleteOrganizationAiInterface()` |
| Legacy UI | ✅ 部分 | 表格行有「删除」+ `window.confirm` |
| 火山 UI | ❌ **缺失** | `VolcanoInterfacePanel` 无删除入口 |
| i18n | ✅ 基础 | `deleteConfirm` / `deleted` / `deleteFailed` |

### 2.2 缺口

```
用户视角：火山接口只能添加，不能删除
技术视角：删除 0 行也返回 200；无 isDefault 善后；无工作流引用提示
体验视角：Legacy 用原生 confirm，与全站 AlertDialog 不一致
```

### 2.3 数据与引用关系

```
organization_ai_interfaces (Postgres)
  ├─ api_key_encrypted  — 平台托管的推理 Key（火山为临时 Key）
  ├─ metadata           — 火山 AK/SK 加密、模型启用、探针缓存
  └─ 无 workflow 外键

workflows (R2 图数据)
  └─ ai-text / ai-interface 节点 inputs.ai_interface_id → interface UUID
      （软引用，删除后运行时 resolve 失败）
```

工作流图存 R2，**无法**用 SQL 简单统计引用数；与「工作流方案」删除策略相同——**允许删除，引用方保留旧 ID**。

---

## 3. 产品决策

### 3.1 删除策略：**允许删除，警告不阻断**

| 选项 | 决策 |
|------|------|
| 有工作流引用时 | **警告** + 允许删除（与 `workflow-schemes` 一致） |
| 删除 `isDefault` 接口 | 允许；**不**自动提升其他接口为默认 |
| 火山 AK/SK | 仅从本平台移除；**不**代用户注销火山 IAM Key |
| 最后一个火山接口 | 允许删除；工作流回退到「无接口」告警 |

### 3.2 权限

与现有 AI 接口 CRUD 相同：

- `jwtMiddleware` + 组织成员身份
- `requireFeature("ai-interfaces")`
- 不新增单独 RBAC（与创建/编辑一致）

### 3.3 不可删除场景（本方案不涉及）

- 平台模板 `ai_interface_templates`（管理员侧，已有独立删除逻辑）
- 系统种子接口（若未来引入，另立规则）

---

## 4. UI 方案

### 4.1 火山方舟卡片（`VolcanoInterfacePanel`）

在标题行右侧按钮组增加 **删除**（`variant="ghost"` 或 `destructive` outline）：

```
[接口名称]
[计费提示 / 余额 / ...]
                    [展开] [检测开通] [刷新] [删除]
```

点击删除 → `AlertDialog`（对齐 `secrets-page` / `api-keys-page`，**不用** `window.confirm`）。

### 4.2 Legacy 表格

保留表格内删除，将 `window.confirm` **升级为同一套 `AlertDialog` 组件**，避免两套交互。

### 4.3 确认对话框内容

| 区块 | zh 示例 |
|------|---------|
| 标题 | 删除 AI 接口 |
| 主文案 | 确定删除「{{name}}」？此操作无法撤销。 |
| 火山补充 | 将移除本平台保存的 Access Key 与模型配置；**不会**注销您在火山引擎控制台创建的 IAM 密钥。 |
| 引用警告（可选） | 有 {{count}} 个工作流正在使用此接口，删除后相关节点执行将失败，直至重新选择接口。 |
| 默认标记 | 此为该提供商的默认接口，删除后工作流将使用其他可用接口或组织默认解析规则。 |
| 按钮 | 取消 / 删除（destructive） |

### 4.4 i18n 新增 key（`pages.aiInterfaces`）

| key | zh | en |
|-----|----|----|
| `deleteTitle` | 删除 AI 接口 | Delete AI interface |
| `deleteVolcanoHint` | 将移除本平台保存的凭据与模型配置，不会注销火山控制台 IAM 密钥。 | Removes stored credentials and model settings from this platform. Does not revoke IAM keys in Volcengine console. |
| `deleteDefaultHint` | 这是该提供商的默认接口。 | This is the default interface for its provider. |
| `deleteInUseWarning` | {{count}} 个工作流正在使用此接口，删除后相关节点将无法正常执行。 | {{count}} workflow(s) reference this interface. Affected nodes will fail until reconfigured. |
| `deleteButton` | 删除 | Delete |

现有 `deleteConfirm` 可保留作短文案，或合并进 `AlertDialog` 描述。

### 4.5 删除后 UI

- `VolcanoInterfacePanel`：调用 `onDeleted` → 父页 `refreshInterfaces()`，卡片消失
- 若列表为空：显示现有 `volcano.empty` 文案

---

## 5. API 方案

### 5.1 现有路由增强

`DELETE /:organizationId/ai-interfaces/:id`

```ts
// 伪代码
const row = await getOrganizationAiInterfaceRow(db, orgId, id);
if (!row) return c.json({ error: "AI interface not found" }, 404);

await deleteOrganizationAiInterface(db, orgId, id);
return c.json({ success: true });
```

**变更点：** 删除前校验存在性，返回 **404**（当前 0 行删除也 200）。

### 5.2 可选：引用统计端点（Phase 2）

```
GET /:organizationId/ai-interfaces/:id/usage-summary
→ { workflowCount: number; workflowNames?: string[] }  // 最多 5 个名称
```

实现思路：

1. `WorkflowStore.list(organizationId)` 取元数据
2. 从 R2 拉取各 workflow `nodes`
3. 匹配 `inputs` 中 `ai_interface_id === id` 的 `ai-text` / `ai-interface` / 未来 `ai-image` / `ai-video`

**性能：** 组织工作流多时较慢 → 对话框可先打开，统计异步加载；或 Phase 1 不做统计，仅静态警告文案。

### 5.3 响应类型（`packages/types`）

```ts
export interface DeleteOrganizationAiInterfaceResponse {
  readonly success: true;
}

export interface AiInterfaceUsageSummary {
  readonly workflowCount: number;
  readonly workflowNames: readonly string[];
}
```

### 5.4 不需要的后端逻辑

- ❌ 级联修改工作流图（成本高、易误伤）
- ❌ 调用火山 API 吊销 IAM / Ark Key（平台无义务、且 AK 可能他用）
- ❌ 软删除 / 回收站（当前无合规需求）

---

## 6. 前端实现要点

### 6.1 组件拆分（推荐）

```
apps/app/src/pages/organization-ai-interfaces/
  delete-ai-interface-dialog.tsx   # 共用 AlertDialog
```

Props:

```ts
interface DeleteAiInterfaceDialogProps {
  readonly iface: OrganizationAiInterface | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted: () => Promise<void>;
}
```

### 6.2 `VolcanoInterfacePanel` 变更

- 新增 props：`onDeleted?: () => Promise<void>`（或复用 `onUpdated`）
- 标题栏增加删除按钮 → 打开 `DeleteAiInterfaceDialog`
- 删除中禁用按钮 + loading

### 6.3 `OrganizationAiInterfacesPage` 变更

- 抽出 `handleDelete` 逻辑到 dialog 组件
- Legacy 表格删除改为打开同一 dialog
- 移除 `window.confirm`

### 6.4 Service 扩展（Phase 2）

```ts
export async function fetchAiInterfaceUsageSummary(
  organizationId: string,
  id: string
): Promise<AiInterfaceUsageSummary>
```

---

## 7. 运行时影响（工作流）

删除后，节点 `ai_interface_id` 仍指向已删 UUID：

| 解析路径 | 行为 |
|----------|------|
| 显式 `interfaceId` | `resolveOrganizationAiInterfaceRow` → 未找到 → 执行失败 |
| 留空（组织默认） | 按 `templateId` / `isDefault` 解析其他接口 |

**用户修复：** 在工作流 AI 节点重新选择接口，或配置新接口。

**文档/提示：** 删除确认框说明即可；无需自动清理节点字段。

---

## 8. 分阶段实施

### Phase 1 — 最小可用（推荐先做）

- [ ] API：DELETE 返回 404 when not found
- [ ] `DeleteAiInterfaceDialog` 组件
- [ ] `VolcanoInterfacePanel` 删除按钮
- [ ] Legacy 表格改用 AlertDialog
- [ ] i18n zh/en
- [ ] 手动测试：删除火山接口、删除 Legacy、删后列表刷新

### Phase 2 — 引用感知（可选）

- [ ] `GET .../usage-summary` 扫描工作流
- [ ] 确认框展示 `workflowCount` / 名称列表
- [ ] 集成测试：建 workflow + 删 interface → 执行失败信息可读

### Phase 3 — 体验抛光（可选）

- [ ] 删除成功后 toast 带「查看工作流」链接（count > 0 时）
- [ ] 工作流 AI 面板：选中接口已删除时显示「接口不存在」+ 跳转配置页

---

## 9. 测试计划

| 用例 | 预期 |
|------|------|
| 删除存在的火山接口 | 200，`interfaces` 列表少一条 |
| 删除不存在的 id | 404 |
| 删后 Snapshot / probe 路由 | 404 |
| 工作流节点仍引用旧 id | 执行报错，提示接口未找到 |
| 删除 `isDefault=true` 接口 | 成功；其他接口不自动变默认 |
| 无 `ai-interfaces` feature | 403（与现有一致） |
| UI：取消删除 | 无 API 调用，卡片仍在 |

---

## 10. 风险

| 风险 | 缓解 |
|------|------|
| 用户误以为会注销火山 IAM | 确认框明确文案 |
| 工作流静默失败 | 删除警告 + Phase 3 节点内提示 |
| usage-summary 慢 | 异步加载 / Phase 2 可选 |
| 误删 | 二次确认 + destructive 样式 |

---

## 11. 文件索引（拟改）

```
apps/api/src/routes/ai-interfaces.ts              # 404 on delete
apps/api/src/db/ai-interface-queries.ts           # 可选 returning()
apps/app/src/pages/organization-ai-interfaces-page.tsx
apps/app/src/pages/organization-ai-interfaces/volcano-interface-panel.tsx
apps/app/src/pages/organization-ai-interfaces/delete-ai-interface-dialog.tsx  # 新增
apps/app/src/services/organization-ai-interface-service.ts
apps/app/src/i18n/locales/zh.ts / en.ts
packages/types/src/ai-interface.ts                # Phase 2 类型
```

---

## 12. 结论

删除能力**后端已具备**，主要工作是：

1. **火山面板补删除入口**（当前唯一明显缺口）
2. **统一 AlertDialog 确认**（含火山凭据说明）
3. **DELETE 404 语义修正**
4. （可选）工作流引用统计与警告

与方案删除、密钥删除等产品惯例保持一致：**允许删除，充分告知后果，不自动改写工作流图**。
