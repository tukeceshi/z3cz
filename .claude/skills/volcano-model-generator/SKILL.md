---
name: volcano-model-generator
description: 在 Dafthunk 新增或下线火山方舟模型 — types 目录、DB 迁移、推理鉴权与画布集成要点
---

# 火山方舟模型 Skill

新增或移除模型前先读本 skill。全链路 **`canonicalId` 保持一致**（kebab-case）。

## 新增模型：必触达面

| 层级 | 位置 | 要点 |
|------|------|------|
| 类型目录 | `packages/types/src/ai-model-catalog.ts` | `VOLCANO_AI_MODEL_CATALOG` |
| 定价 | `packages/types/src/volcano-pricing-catalog.ts` | `VOLCANO_MODEL_PRICING_CATALOG` |
| 资源包 | `packages/types/src/volcano-package-catalog.ts` | 模型 ID 匹配键 + `VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID` |
| 数据库 | `apps/api/src/db/migrations/00NN_*.sql` | `platform_ai_models`；可选 `platform_ai_model_groups` |
| 迁移注册 | `apps/api/src/db/migrations/meta/_journal.json` | 与 SQL 同步登记 |

**执行迁移前**，types 与 SQL 中的 `provider_model_id` 必须一致；**只改 types 不跑迁移** → Admin / 画布不可见。

## 新增前向用户确认

- `canonicalId`、`displayName`、模态（text / image / video）
- **`providerModelId`**：在线推理 ModelId（见下），不是控制台展示名或 Coding Plan 名
- 资源包：按模型 ID 匹配账单包 Code（见 `volcano-package-catalog`；特殊匹配键另列）
- 定价与 `monthlyFreeQuota`
- 文字模型 `parameter_rules`（可复制已有同模态条目）

## providerModelId 怎么定

- 来源：火山 **`ListFoundationModels` → `ListFoundationModelVersions` → 行的 `ModelId`**
- 写入：`ai-model-catalog`、`platform_ai_models.provider_model_id`
- 例：`glm-5-2` → `glm-5-2-260617`（带日期后缀的在线推理 ID）

探测脚本（可选）：`apps/api/scripts/probe-billing-catalog-map.ts`、`probe-glm-chat.ts`

## 推理与 API Key（经验摘要）

**Chat API 本身直接用 ModelId 即可，不必为聊天专门 CreateEndpoint。**

| 概念 | 说明 |
|------|------|
| 接口级 Key | 每个火山接口 **一个** `api_key_encrypted`，由 `ensureVolcanoApiKey` 统一签发/续期 |
| endpoint 映射 | 存在 **`metadata.arkEndpoints`**（canonicalId → `ep-*`），**不要**在 `VolcanoModelConfig` 上分散 `endpointId` |
| Key 作用域 | `metadata.arkApiKeyScope`：`endpoint`（临时 Key 绑 endpoint）或 `model`（控制台 Raw Key） |
| 实际 `model` 字段 | `resolveVolcanoInferenceModelId`：endpoint 作用域且有映射 → `ep-*`；否则 → `providerModelId` |

**首次调用 403 教训**：须在 **`ensureVolcanoApiKey` 完成之后** 再解析 inference model id（`resolveVolcanoInferenceModelIdAfterEnsure`）。生成入口：`platform-ai.ts` 各 generate/submit 路由；工作流：`ai-text-node` 在 `resolveAiInterface` 之后刷新。

相关实现（一般**无需因加模型而改**，加模型时知晓即可）：

- `integrations/volcengine/ensure-api-key.ts`、`get-api-key.ts`
- `integrations/volcengine/resolve-inference-model-id.ts`
- `packages/types/src/volcano-ark-access.ts`
- `services/resolve-text-model-interface.ts`

## 已有接口的行为

- 新模型进 catalog 后，已有火山接口 metadata 会在快照/同步时以 **`enabled: false`** 补全，用户需在面板手动开启。
- 资源包已开通但 probe  stale 时，以 **`volcano-effective-activation`**（包 provisioned 覆盖 probe）为准。

## 下线模型

与新增对称，**不可只删一处**：

| 层级 | 动作 |
|------|------|
| 三个 types catalog | 删除对应 `canonicalId` 条目 |
| 迁移 | `DELETE FROM platform_ai_models`；清理 `organization_model_interface_priorities`；无引用时分组可删 |
| `_journal.json` | 登记移除迁移 |

## 不必改

- `ai-text` / `ai-image` / `ai-video` 节点实现（读 platform API）
- 火山向导、接口面板、画布配置面板 React（读 catalog / DB）
- 按模型单独 i18n（用 catalog `alias` / DB `display_name`）

## 已知资源包对照

按模型 ID 匹配账单 `ConfigurationCode`（`-`→`_`，不区分大小写；例外：`glm-5-2`→`glm_5.2`，`doubao-seedance-2-fast`→`doubao_seedance_2.0_fast`，`doubao-seedance-2-mini`→`doubao_seedance_2.0_mini`）。一对多时取更长匹配键。

| canonicalId | providerModelId |
|-------------|-----------------|
| `deepseek-v4-pro` | `deepseek-v4-pro-260425` |
| `deepseek-v4-flash` | `deepseek-v4-flash-260425` |
| `glm-5-2` | `glm-5-2-260617` |
| `doubao-seed-evolving` | `doubao-seed-evolving` |

## 参考文件

`0008_platform_ai_models.sql`（parameter_rules）、`0010_platform_ai_model_groups.sql`（分组）、`metadata.ts`（catalog 合并）、`snapshot.ts`（用量快照）、`admin-ai-models-page.tsx`（Admin）
