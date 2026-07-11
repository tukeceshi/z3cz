# 火山方舟模型开通状态探测方案（v2）

> 验证日期：2026-07-11  
> 状态：**方案已定 + 探测已完成**，**尚未实现**  
> 关联：[volcano-ark-api-verification.md](./volcano-ark-api-verification.md)

---

## 0. 方案结论（TL;DR）

| 手段 | 能否判断「未开通」 | 推荐 |
|------|-------------------|------|
| **GetInferenceUsage（用量接口）** | ❌ **不能** | 仅用于用量展示，与开通状态解耦 |
| **推理 API 最小请求** | ✅ 能（`ModelNotOpen`） | **开通检测唯一可靠手段** |
| 管控面开通查询 API | ❌ 不存在 | — |

用量接口对「已开通 / 未开通 / 伪造模型名」返回**完全相同**的空结果（`DataCount=0`），**不具备判别特征**。  
推理 API 可通过 `error.code` 精确区分，且 image/video 可用 **InvalidParameter 探针**避免真实出图/建任务。

---

## 1. 错误码 taxonomy（推理面）

火山方舟推理 API（`https://ark.cn-beijing.volces.com/api/v3`）公共错误码，开通检测需完整区分：

| `error.code` | HTTP | `error.type` | 含义 | 开通判定 |
|--------------|------|--------------|------|----------|
| **`ModelNotOpen`** | 404 | `Not Found` | 账号**未在控制台开通**该模型服务 | ❌ `not_open` |
| **`InvalidEndpointOrModel.NotFound`** | 404 | `Not Found` | 模型 / 推理接入点**不存在**或无权访问（含 ModelId 填错、用 FoundationModelName 调推理） | ⚠️ `invalid_model_id` |
| **`OperationDenied.ServiceNotOpen`** | 403* | `Forbidden`* | 模型服务**不可用、未激活**（官方文档：常与接入点/服务未启用相关） | ❌ `not_open` 或 `service_not_open` |
| `AuthenticationError` | 401 | `Unauthorized` | API Key 无效 | `auth_error` |
| `InvalidParameter` | 400 | — | 模型已识别，参数不合法 | ✅ `open` |
| 2xx | 200 | — | 推理成功 / 任务已创建 | ✅ `open` |

\* `OperationDenied.ServiceNotOpen`：**本次探测未在用量接口或 catalog 八模型推理中复现**；纳入 taxonomy 供实现时映射，遇则与 `ModelNotOpen` 同等视为未就绪。二者 UI 均引导至 [openManagement](https://console.volcengine.com/ark/region:cn-beijing/openManagement)。

### 1.1 三者语义区分（产品文案）

| 错误码 | 用户可读说明 |
|--------|-------------|
| `ModelNotOpen` | 请先在火山控制台「开通管理」中开通该模型 |
| `OperationDenied.ServiceNotOpen` | 模型服务未激活或接入点未就绪，请在控制台检查服务状态 |
| `InvalidEndpointOrModel.NotFound` | 模型 ID 配置有误，请检查平台 catalog 与 ModelId |

---

## 2. GetInferenceUsage 替代方案验证（**否定**）

脚本：`probe-volcano-usage-activation.ts`、`probe-volcano-usage-activation-2.ts`

### 2.1 测试矩阵

对 catalog **8 个模型**（6 已开通 / 2 未开通，ground truth 来自推理探测）逐项测试：

- 无过滤、`ModelName`、`ModelNames[]`、`Filter.ModelName`
- `GroupByFields: ["ModelName"]`、`["ModelName","BillingStatus"]`
- 伪造模型名 `definitely-not-a-real-model-000000`
- 错误 FoundationModelName `deepseek-v4-pro`

### 2.2 结果：无判别特征

| 维度 | 已开通 (6) | 未开通 (2) | 伪造模型 |
|------|-----------|-----------|---------|
| HTTP | 200 | 200 | 200 |
| `DataCount` | 0 | 0 | 0 |
| `Fields` | 账户级 9 列 | 相同 | 相同 |
| 含 `ModelName` 列 | ❌ | ❌ | ❌ |
| 报错 `ModelNotOpen` / `ServiceNotOpen` | ❌ | ❌ | ❌ |

**全部返回相同结构**：

```json
{
  "Fields": ["AccountID","ProjectName","Day","InputTokens","CacheTokensHit","OutputTokens","ImageCount","TotalTokens","ReqCnt"],
  "DataCount": 0
}
```

### 2.3 推论

| 误解 | 事实 |
|------|------|
| `DataCount=0` ⇒ 未开通 | ❌ 仅表示查询窗口内**无用量记录** |
| `ModelName` 过滤可筛未开通模型 | ❌ 未开通模型也返回 200 + 空数据 |
| `GroupByFields` 可暴露未开通列表 | ❌ 无数据时不展开 `ModelName` 维度 |
| 用量接口会返回 `OperationDenied.ServiceNotOpen` | ❌ 本次所有变体均未触发 |

### 2.4 用量数据的弱相关（不可用于开通检测）

仅当 `DataCount > 0` 且 `Rows` 含某 `ModelName` 时，可推断该模型**曾被调用**（历史上已开通且产生用量）。  
但：

- **不能**反推「未出现在 Rows ⇒ 未开通」（零用量已开通模型与未开通模型响应一致）
- 用量有**结算延迟**（本次推理探测后数小时内 `DataCount` 仍为 0）
- 查询窗口上限 **31 天**

**结论：开通检测不得依赖 GetInferenceUsage；用量接口继续单次拉取供进度条即可。**

---

## 3. 推理 API 探测（推荐方案）

脚本：`probe-volcano-model-activation.ts`、`probe-volcano-activation-minimal.ts`

### 3.1 全量测试结果（账户 2100234125）

| canonicalId | 开通 | 探测方式 | HTTP | `error.code` |
|-------------|------|----------|------|--------------|
| doubao-seed-evolving | ❌ | text chat | 404 | `ModelNotOpen` |
| doubao-seedance-2-mini | ❌ | video task | 404 | `ModelNotOpen` |
| deepseek-v4-pro / flash | ✅ | text chat | 200 | — |
| doubao-seedance-2 / fast | ✅ | video task | 200 | — |
| doubao-seedream-5-pro | ✅ | image gen | 200 | — |
| doubao-seedream-5 | ✅ | image gen | 400 | `InvalidParameter` |

### 3.2 零副作用探针（v2 优化，已实测）

为避免已开通 image/video 的真实计费，使用**故意非法参数**，使模型被识别后返回 `InvalidParameter`，**不创建任务、不出图**：

| 模态 | 端点 | 探针 body 要点 | 已开通响应 | 未开通响应 |
|------|------|---------------|-----------|-----------|
| text | `/chat/completions` | `max_tokens: 1`, prompt `"ping"` | 200（极低 token） | 404 `ModelNotOpen` |
| image | `/images/generations` | `size: "1x1"`（或低于模型最小像素） | 400 `InvalidParameter` | 404 `ModelNotOpen` |
| video | `/contents/generations/tasks` | `duration: 0` | 400 `InvalidParameter` | 404 `ModelNotOpen` |

实测摘录：

```
seedream-pro invalid size (1x1):  HTTP 400 InvalidParameter  hasImage=false
seedance-2 invalid duration (0):  HTTP 400 InvalidParameter  hasTask=false
seedance-2-mini (NOT_OPEN):       HTTP 404 ModelNotOpen
doubao-seed-evolving (NOT_OPEN):  HTTP 404 ModelNotOpen
```

**image/video 已开通时亦可零成本判别**，无需再创建 `cgt-*` 任务或出图。

### 3.3 判定算法

```typescript
type ModelActivationStatus =
  | "open"
  | "not_open"           // ModelNotOpen
  | "service_not_open"   // OperationDenied.ServiceNotOpen
  | "invalid_model_id"   // InvalidEndpointOrModel.NotFound
  | "auth_error"
  | "transient_error";

function classifyInferenceProbe(httpStatus: number, errorCode?: string): ModelActivationStatus {
  if (httpStatus === 401 || errorCode === "AuthenticationError") return "auth_error";
  if (errorCode === "ModelNotOpen") return "not_open";
  if (errorCode === "OperationDenied.ServiceNotOpen") return "service_not_open";
  if (errorCode === "InvalidEndpointOrModel.NotFound") return "invalid_model_id";
  if (httpStatus >= 200 && httpStatus < 300) return "open";
  if (errorCode === "InvalidParameter") return "open";
  if (errorCode && errorCode !== "ModelNotOpen") return "open"; // 429 等
  return "transient_error";
}
```

---

## 4. 系统设计（未开工）

### 4.1 职责分离

```
GetInferenceUsage  ──► 用量聚合 / 进度条（snapshot 单次调用，已有）
推理最小探针      ──► 开通状态（wizard / toggle / 手动「检测开通」）
```

二者**不合并**：用量刷新不触发开通探测；开通探测不写入用量缓存。

### 4.2 模块

```
apps/api/src/integrations/volcengine/
  probe-model-activation.ts     # 按模态构造 InvalidParameter 探针 + classify
```

```typescript
async function probeVolcanoModelActivation(params: {
  apiKey: string;
  entry: AiModelCatalogEntry;
}): Promise<ModelActivationProbeResult>;
```

### 4.3 触发时机

| 场景 | 行为 |
|------|------|
| 向导勾选模型 | 批量推理探针（3 并发） |
| 面板 Toggle 启用 | 单模型探针 |
| Snapshot 刷新 | **不**自动探针 |
| 手动按钮「检测开通状态」 | 批量探针，结果写入 metadata 缓存 TTL 24h |

`not_open` / `service_not_open`：警告 + 外链 openManagement；是否阻止保存由产品定。

### 4.4 API（拟新增）

```
POST /organizations/:orgId/ai-interfaces/:id/probe-activation
Body: { "canonicalIds"?: string[] }
Response: { results: ModelActivationProbeResult[] }
```

### 4.5 前端

- 徽章：`未开通`（琥珀）/ `服务未激活`（琥珀）/ `模型 ID 错误`（红）
- 不将 `DataCount=0` 误展示为「未开通」

---

## 5. 测试清单（实现阶段）

### 5.1 已完成（探测脚本）

- [x] GetInferenceUsage 8 模型 × 多参数变体 — 无判别特征
- [x] 推理 `ModelNotOpen` × 2 未开通模型
- [x] 推理 `InvalidEndpointOrModel.NotFound` 对照
- [x] image/video `InvalidParameter` 零成本探针
- [ ] `OperationDenied.ServiceNotOpen` 实机复现（待有对应账户状态）

### 5.2 实现后

- [ ] Vitest：`classifyInferenceProbe` 全覆盖错误码
- [ ] 向导 / Toggle E2E
- [ ] 确认用量刷新不触发探针

---

## 6. 复现命令

```bash
# 用量接口能否判别开通（结论：不能）
npx tsx scripts/probe-volcano-usage-activation.ts
npx tsx scripts/probe-volcano-usage-activation-2.ts

# 推理探针（开通检测）
npx tsx scripts/probe-volcano-model-activation.ts
npx tsx scripts/probe-volcano-activation-minimal.ts
```

需 `VOLC_AK`、`VOLC_SK` 环境变量。

---

## 7. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-11 | v1：推理探测方案 |
| 2026-07-11 | v2：验证 GetInferenceUsage **不可**替代推理；补充三错误码 taxonomy；image/video InvalidParameter 零成本探针 |
