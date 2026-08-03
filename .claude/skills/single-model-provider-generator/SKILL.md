---
name: single-model-provider-generator
description: 新增「品牌 API」一卡多模型接口。用户提到品牌 API、provider:xxx、一卡多模型、独立 API Key 时使用。
---

# 品牌 API

一品牌 = 一张向导卡片 + 多个平台模型。用户填 Endpoint、API Key；列表名写在 `iface.name`。推理用 `metadata.models[].upstreamModelId`，不走火山聚合鉴权。

## 已有品牌

| 模态 | preset id | 默认 Endpoint | upstream 默认值 |
|------|-----------|---------------|------------------|
| 文字 | `provider:deepseek` | `https://api.deepseek.com` | `DEEPSEEK_DEFAULT_UPSTREAM_MODEL_IDS`（≠ 火山 catalog 后缀 id） |
| 文字 | `provider:seed` / `provider:glm` | `https://ark.cn-beijing.volces.com/api/v3` | catalog `providerModelId` |
| 文字 | `provider:kimi` | `https://api.moonshot.cn/v1` | 官方 model id；不进火山向导 |
| 视频 | `provider:seedance` | 同上 Ark | catalog `providerModelId` |
| 生图 | `provider:seedream` | 同上 Ark | catalog `providerModelId` |

新增文字品牌按 **GLM** 抄即可；仅 Endpoint / upstream / 图标 / 平台模型 id 不同。

## 存库结构

```ts
provider: "custom"
metadata.singleModelPresetId: "provider:xxx"
metadata.models: { [canonicalId]: { enabled, upstreamModelId, modality } }
```

create 时为该品牌**全部** canonical 写一条（未勾选 `enabled: false`）。

## 新增步骤

1. **Migration** — Admin 只读 DB、不能新建模型。插入 `platform_ai_models`（身份字段 + rules，**无** `provider_model_id`）+ 可选分组；静态 catalog 的 `providerModelId` 仅作接口 metadata / 品牌 upstream 种子。
2. **Types** — `XXX_PROVIDER_CARD_ID`、`XXX_CANONICAL_IDS`、`XXX_DEFAULT_ENDPOINT_URL`；`single-model-preset-catalog.ts` 排除 canonical，避免重复 preset。
3. **向导** — `single-model-picker-step` 品牌卡 → `single-model-wizard-content` 的 `multiModelProviderConfig` → 复用 `DeepSeekModelConfigList` → i18n `presets.xxxProvider`。
4. **列表/配置** — `single-model-config-dialog` 加入 `isMultiModelProvider`；`model-brand-icon` 用本地 `assets/model-brand-icons/`。
5. **解析** — 推理只用接口 `upstreamModelId` / 火山 metadata；**无平台默认上游回退**。

## 两种例外

**DeepSeek** — 默认 upstream 用 `DEEPSEEK_DEFAULT_UPSTREAM_MODEL_IDS`，勿改 catalog 里火山用的带后缀 `providerModelId`。

**Kimi（Moonshot 官方，非火山）** — 另做：
- `MOONSHOT_BRAND_ONLY_CANONICAL_IDS`；火山侧用 `VOLCANO_AGGREGATE_MODEL_CATALOG`
- `toVolcanoCatalogEntriesFromPlatform()` 过滤 Kimi
- Endpoint 小字：`KimiEndpointRegionHints`（国内 / 境外）
- 不写 `volcano-package-catalog` / `volcano-pricing-catalog`

## 主要文件

```
apps/api/src/db/migrations/
packages/types/src/ai-model-catalog.ts
packages/types/src/single-model-interface-metadata.ts
packages/types/src/single-model-preset-catalog.ts
apps/app/src/pages/organization-ai-interfaces/single-model-picker-step.tsx
apps/app/src/pages/organization-ai-interfaces/single-model-wizard-content.tsx
apps/app/src/pages/organization-ai-interfaces/single-model-config-dialog.tsx
apps/app/src/pages/organization-ai-interfaces/model-brand-icon.tsx
apps/api/src/services/resolve-text-model-interface.ts
apps/api/src/integrations/volcengine/metadata.ts
```
