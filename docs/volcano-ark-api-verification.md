# 火山方舟（Ark）API 验证记录

> 验证日期：2026-07-11  
> API 版本：`2024-01-01`  
> Host：`ark.cn-beijing.volcengineapi.com`  
> 测试账号：无推理用量历史（`GetInferenceUsage.DataCount = 0`）、无 Endpoint

本文档基于 `apps/api/scripts/probe-volcano-api-verify*.ts` 对真实 AK/SK 的探测结果整理，供后续用量展示、模型开通校验、v3 UI 方案使用。**当前仅文档，不含实现。**

---

## 1. 复现方式

```bash
# Docker 开发环境内
docker exec \
  -e VOLC_AK="<access-key>" \
  -e VOLC_SK="<secret-key>" \
  dafthunk-dev-1 sh -c "cd /app/apps/api && npx tsx scripts/probe-volcano-api-verify.ts"

# 补充探测（版本、配额、开通类 API 猜测）
npx tsx scripts/probe-volcano-api-verify-2.ts
npx tsx scripts/probe-volcano-api-verify-3.ts
npx tsx scripts/probe-volcano-api-verify-4.ts
```

相关实现代码：

- 签名与调用：`apps/api/src/integrations/volcengine/client.ts`
- 用量单次拉取：`apps/api/src/integrations/volcengine/get-inference-usage.ts`
- 解析与聚合：`apps/api/src/integrations/volcengine/parse-inference-usage.ts`、`aggregate-volcano-usage.ts`
- Snapshot 组装：`apps/api/src/integrations/volcengine/snapshot.ts`

官方文档参考：

- 用量：[GetInferenceUsage](https://console.volcengine.com/ark/region:cn-beijing/docs/82379/2116766?lang=zh)（同 `VOLCANO_USAGE_DOC_URL`）
- 定价：[模型服务价格](https://docs.volcengine.com/docs/82379/1544106?lang=zh)
- 控制台开通页：[openManagement](https://console.volcengine.com/ark/region:cn-beijing/openManagement)

---

## 2. API 可用性总览

| Action | 状态 | 说明 |
|--------|------|------|
| `GetInferenceUsage` | ✅ | 单次账户级查询可用；见 §3 |
| `ListFoundationModels` | ✅ | 支持 `Filter.Name` 模糊过滤 |
| `GetFoundationModel` | ✅ | 参数为 **FoundationModelName**（无版本后缀） |
| `ListFoundationModelVersions` | ✅ | 参数为 `FoundationModelName`（非 `Name`） |
| `GetFoundationModelVersion` | ✅ | `FoundationModelName` + `ModelVersion` |
| `ListEndpoints` | ✅ | 本账号返回空列表 |
| `ListCustomModels` | ✅ | 本账号返回空列表 |
| `ListAccountQuotas` | ✅ | 账户配额列表；见 §6 |
| `ListApiKeys` / `GetApiKey` / `GetRawApiKey` | ✅ | 已在凭证流程中验证（见历史修复） |
| `ListPurchaseInfo` | ❌ | `Could not find operation` |
| `ListUsageInfo` | ❌ | 同上 |
| `ListResourcePackages` 等资源包类 | ❌ | 同上 |
| `ListQuota` / `GetQuota` | ❌ | 同上 |
| 模型「开通」类（见 §5 猜测列表） | ❌ | 均在 `2024-01-01` 下不存在 |

---

## 3. GetInferenceUsage

### 3.1 已验证请求体

```json
{
  "StartTime": "2026-06-12",
  "EndTime": "2026-07-11",
  "QueryInterval": "Day",
  "ProjectName": "default"
}
```

约束（已从报错与成功调用归纳）：

- `StartTime` / `EndTime`：格式 **`yyyy-MM-dd`**（ISO 日期字符串，非 Unix 时间戳）
- `QueryInterval`：必须传 **`"Day"`**（与日期粒度匹配）
- 窗口：当前实现取近 **29 天**（`VOLCANO_USAGE_LOOKBACK_DAYS`）

可选过滤（均返回 HTTP 200，空账号下 `DataCount: 0`）：

- `ModelName`：已测 `doubao-seed-evolving`、`deepseek-v4-pro-260425` 等 catalog `providerModelId`
- `BillingStatus`：见 §3.3

### 3.2 空账号响应 Fields（无 ModelName / BillingStatus 维度）

当 `DataCount = 0` 时，`Fields` 仅包含：

| Name | Type |
|------|------|
| AccountID | BIGINT |
| ProjectName | STRING |
| Day | DATE |
| InputTokens | BIGINT |
| CacheTokensHit | BIGINT |
| OutputTokens | BIGINT |
| ImageCount | BIGINT |
| TotalTokens | BIGINT |
| ReqCnt | BIGINT |

**待有真实用量后确认**：`Rows` 中是否出现 `ModelName`（或 `FoundationModelName`）、`BillingStatus` 列，以及 `ModelName` 取值是 FoundationModelName 还是带版本后缀的 ModelId。

### 3.3 BillingStatus 过滤探测

以下值作为 `BillingStatus` 请求参数时 **均被 API 接受**（未报错），但空账号无法区分是否真有对应数据：

| 探测值 | 备注 |
|--------|------|
| `free_for_free_quota` | 代码已按免费额度归类 |
| `free_for_limit_boundary` | 代码已按免费额度归类 |
| `paid` | 接受；是否等价于按量付费待确认 |
| `pay_as_you_go` | 接受 |
| `package` | 接受 |
| `resource_package` | 接受 |
| `token_package` | 接受（v3「Token 资源包」候选） |
| `prepaid` / `postpaid` | 接受 |

当前聚合逻辑（`aggregate-volcano-usage.ts`）仅将前两项视为 free，其余归入 paid。

### 3.4 用量指标与模态映射

| 模态 | 展示用量字段 | 说明 |
|------|-------------|------|
| text | `TotalTokens` | 含 input + output |
| video | `TotalTokens` | 视频按 token 计费，不用 `ReqCnt` |
| image | `ImageCount` | 张数 |

### 3.5 设计建议（单次调用 + 与开通检测解耦）

- ✅ **一次** `GetInferenceUsage`（无 `BillingStatus` 过滤），从 `Rows` 按 `ModelName` + `BillingStatus` 聚合——与现实现一致。
- ❌ 不要对每模型或每 BillingStatus 并行多次调用。
- ❌ **不得**用 `GetInferenceUsage` 判断模型是否开通（见 [activation 方案 v2](./volcano-model-activation-probe-plan.md) §2）：`DataCount=0` 对已开通/未开通无差别。
- 开通检测使用推理 API `ModelNotOpen` 探针（同文档 §3）。

---

## 4. 模型命名：Catalog ↔ Ark API

方舟存在三层 ID，**不可混用**：

| 概念 | 示例 | 用于 |
|------|------|------|
| **FoundationModelName** | `deepseek-v4-pro` | `GetFoundationModel`、`ListFoundationModelVersions` |
| **ModelVersion** | `260425` | 版本列表、`GetFoundationModelVersion` |
| **ModelId**（推理调用 ID） | `deepseek-v4-pro-260425` | Chat/视频推理、`VOLCANO_AI_MODEL_CATALOG.providerModelId` |

`GetFoundationModel` **不接受**带版本后缀的名称（如 `deepseek-v4-pro-260425` → `not found`）。

### 4.1 VOLCANO_AI_MODEL_CATALOG 映射表（已验证）

| canonicalId | providerModelId | FoundationModelName | PrimaryVersion | ModelId |
|-------------|-----------------|---------------------|----------------|---------|
| doubao-seed-evolving | doubao-seed-evolving | doubao-seed-evolving | latest-version | doubao-seed-evolving |
| deepseek-v4-pro | deepseek-v4-pro-260425 | deepseek-v4-pro | 260425 | deepseek-v4-pro-260425 |
| deepseek-v4-flash | deepseek-v4-flash-260425 | deepseek-v4-flash | 260425 | deepseek-v4-flash-260425 |
| doubao-seedance-2 | doubao-seedance-2-0-260128 | doubao-seedance-2-0 | 260128 | doubao-seedance-2-0-260128 |
| doubao-seedance-2-fast | doubao-seedance-2-0-fast-260128 | doubao-seedance-2-0-fast | 260128 | doubao-seedance-2-0-fast-260128 |
| doubao-seedance-2-mini | doubao-seedance-2-0-mini-260615 | doubao-seedance-2-0-mini | 260615 | doubao-seedance-2-0-mini-260615 |
| doubao-seedream-5-pro | doubao-seedream-5-0-pro-260628 | doubao-seedream-5-0-pro | 260628 | doubao-seedream-5-0-pro-260628 |
| doubao-seedream-5 | doubao-seedream-5-0-260128 | doubao-seedream-5-0 | 260128 | doubao-seedream-5-0-260128 |

解析规则建议（供后续动态校验实现）：

1. 用 `ListFoundationModelVersions` 的 `Items[].ModelId` 与 catalog `providerModelId` 精确匹配。
2. `GetFoundationModel` 回退名：去掉末尾 `-{6位数字}` 版本后缀，且 **勿** 把 `doubao-seedance-2-0-fast` 误匹配为 `doubao-seedance-2-0`（探测中曾出现此误匹配）。

### 4.2 ListFoundationModelVersions 典型字段

```json
{
  "FoundationModelName": "deepseek-v4-flash",
  "ModelVersion": "260425",
  "ModelId": "deepseek-v4-flash-260425",
  "Status": "Published",
  "AccessType": "Public",
  "CapabilityLabels": {
    "Experienceable": true,
    "DeepThinkable": true,
    "FunctionCallable": true
  }
}
```

`ListFoundationModels` 条目另有 `FoundationModelTag.CustomizedTags`（如「支持体验」）、部分模型带 `RestrictOpenTimeStamp`（含义未在 API 文档中明确，**不能**当作已开通状态）。

---

## 5. 模型开通状态

### 5.1 管控面：无查询 API

本次探测 **未找到** 任何可用的开通状态查询 API（`2024-01-01`），包括但不限于：

`ListFoundationModelOpenings`、`ListOpenFoundationModels`、`GetFoundationModelOpenStatus`、`OpenFoundationModel` 等。

### 5.2 推理面：ModelNotOpen 探测（已验证，推荐）

无法从管控面或 **GetInferenceUsage** 获取开通状态时，对 Ark 推理 API 发最小请求判断（详见 [volcano-model-activation-probe-plan.md](./volcano-model-activation-probe-plan.md) v2）。

**GetInferenceUsage 不能用于开通检测**（2026-07-11 实测）：已开通 / 未开通 / 伪造模型名均返回 `DataCount=0` + 相同 `Fields`，无 `ModelNotOpen` 等错误。

推理面错误码：

| `error.code` | 含义 |
|--------------|------|
| `ModelNotOpen` | 账号未开通该模型 |
| `InvalidEndpointOrModel.NotFound` | 模型/接入点不存在或 ID 错误 |
| `OperationDenied.ServiceNotOpen` | 服务未激活（taxonomy 已收录，待实机复现） |
| `InvalidParameter` | 已开通（可用故意非法参数做零成本 image/video 探针） |

探测脚本：`probe-volcano-model-activation.ts`、`probe-volcano-usage-activation*.ts`

---

## 6. ListAccountQuotas

`ListAccountQuotas` 可用（本账号 `TotalCount: 39`），但内容与 **月度免费推理额度** 无关：

- 主要为 Endpoint **TPM 保障包**配额（`Type: ModelTPM`，如 `Doubao-Seed-1.8_TPM_IN10K`）
- 单位为「万 token / 千 token」的 **速率保障**，非月度累计用量上限
- `QuotaCapacity.Total` / `Allocated` 表示可购/已分配席位数，不是 GetInferenceUsage 里的 free quota

结论：**月度免费额度**（`VOLCANO_MODEL_PRICING_CATALOG.monthlyFreeQuota`）仍需静态 catalog + GetInferenceUsage 用量相减；**Token 资源包总容量**暂无 API 来源。

---

## 7. 当前实现与文档对齐情况

| 能力 | 实现状态 | 与 API 验证关系 |
|------|----------|----------------|
| 单次 GetInferenceUsage | ✅ | 与 §3.5 一致 |
| 按模型 + BillingStatus 聚合 | ✅ | 依赖 §3.2 待确认字段 |
| 免费 BillingStatus 白名单 | ✅ | 仅确认过滤合法，枚举不完整 |
| monthlyFreeQuota 进度条 | ✅ 静态 | 非 API 下发 |
| 定价表 | ✅ 静态 | 来自官方定价页 |
| 模型开通检测 | ❌ | §5 无 API |
| Token 包剩余额度 | ❌ | §3.5 / §6 无 API |
| 资源包购买提示 | ✅ 文案 | 无自动检测 |

---

## 8. v3 方案修订建议（仅规划，未开工）

基于本次验证，对原 v3 UI/UX 计划的调整建议：

### 8.1 进度条 = 剩余额度

- **免费额度**：`remaining = monthlyFreeQuota - freeUsed`（freeUsed 来自 `BillingStatus ∈ {free_for_free_quota, free_for_limit_boundary}`）；quota 来源保持静态 catalog。
- **Token 资源包**：`cappedQuota` **无法从 API 获取**；仅有 `token_package` 行的已用量时，可显示「包内已用」文本，**不宜**画剩余进度条，除非用户手动配置包大小或后续发现新 API。
- **按量付费**：仅展示 `paidUsed` 文本，无进度条——与计划一致。

### 8.2 模型开通校验

- **采用推理探测**：`error.code === ModelNotOpen` → 未开通；链到 [openManagement](https://console.volcengine.com/ark/region:cn-beijing/openManagement)。
- 须用 `providerModelId`（ModelId），不能用 FoundationModelName。
- 视频模型探测会创建真实 `cgt-*` 任务：实现前需产品确认是否对 video 执行自动探测（详见 activation 方案 §7）。

### 8.3 其他 UI 项

- 双列 masonry、定价 Popover、资源包提示上移：与 API 验证无冲突，可按原方案实施。
- AK/SK 防自动填充：纯前端，与 API 无关。

---

## 9. 待复验项（需要有用量/已购资源包的账号）

1. `GetInferenceUsage` 有数据时 `Fields` 是否包含 `ModelName`、`BillingStatus`。
2. `Rows` 中 `ModelName` 与 catalog `providerModelId` / `FoundationModelName` 的对应关系。
3. `BillingStatus` 完整枚举及与 UI 三分法（免费 / 资源包 / 按量）的映射。
4. `token_package` 行是否可单独汇总为「包内用量」。
5. 是否存在计费子产品 API（非 `ark/2024-01-01`）可查资源包余额。

---

## 10. 安全提示

测试用 AK/SK 曾在对话与探测脚本中出现，**应在火山控制台轮换**，后续探测请使用环境变量注入，勿提交到仓库。
