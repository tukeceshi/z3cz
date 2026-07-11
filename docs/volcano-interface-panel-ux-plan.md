# 火山接口面板 UX 与开通检测加固方案

> 日期：2026-07-11  
> 状态：**方案已定，未实现**  
> 关联：[volcano-resource-packages-migration-plan.md](./volcano-resource-packages-migration-plan.md)、[volcano-model-activation-probe-plan.md](./volcano-model-activation-probe-plan.md)、[ai-interface-delete-plan.md](./ai-interface-delete-plan.md)

---

## 1. 目标

| # | 需求 |
|---|------|
| A | 用量区去掉资源包名称；多包聚合时避免误导 |
| B | 进度条「已用」段更易辨认；悬停仅显示百分比；**具体 token/张数仍在进度条下方四行展示** |
| C | 梳理开通检测，防止 Seedream 5.0 Pro 等「无包但已开通」偶发误判 |
| D | 去掉临时密钥状态行 |
| E | 账户余额置于名称下第一行、重点展示 |
| F | 产品名改为 **火山引擎-火山方舟-字节跳动旗下** |

---

## 2. 用量区（`volcano-usage-meter.tsx`）

### 2.1 移除资源包名称

**现状：** 聚合后取第一个 `ConfigurationName` 写入 `usage.packageName`，底部单独一行展示。

**问题：** 多包（Effective + UsedUp）时只显示一个包名，用户易以为用量仅来自该包，与控制台「按模型汇总」不一致。

**方案：**

| 项 | 动作 |
|----|------|
| UI | 删除 `usage.packageName` 展示块 |
| 类型 | 从 `VolcanoModelUsage` 移除 `packageName` 字段 |
| 后端 | `aggregate-package-usage.ts` 不再写入 `packageName` |

四行数字（已用 / 过期 / 剩余 / 总共）**保留在进度条下方**（`grid-cols-2` 布局不变），与火山控制台对齐；Tooltip **不替代**此行明细。

### 2.2 进度条：已用段可见 + 悬停百分比

**现状：** 单条 `bg-primary` 宽度 = `remaining / quota`（`usagePercent`），已用部分仅为 `bg-muted` 底色，对比弱。

**布局（自上而下）：**

```
┌──────────────────────────────────────┐
│ ████████已用████████░░░░剩余░░░░░░░ │  ← 双色分段；hover 仅百分比
└──────────────────────────────────────┘
  已用 2.83 百万 tokens    过期 0 百万 tokens
  剩余 2.17 百万 tokens    总共 5 百万 tokens   ← 见 §2.3 格式化
```

**分段计算：**

```ts
usedPercent   = quota > 0 ? round(used / quota * 100) : 0
remainPercent = quota > 0 ? round(remaining / quota * 100) : 0
// usedPercent + remainPercent + expiredPercent ≈ 100（过期可从 used 中拆开展示可选）
```

**样式建议：**

| 段 | 类名思路 |
|----|----------|
| 轨道 | `bg-muted h-2.5 rounded-full overflow-hidden flex` |
| 已用 | `bg-muted-foreground/35` 或 `bg-orange-500/60`（与剩余区分） |
| 剩余 | `bg-primary` |
| 过期（可选第三段） | `bg-destructive/40`，仅 `expired > 0` 时画 |

**Tooltip（`Tooltip` + `TooltipTrigger` 包裹整条轨道）：**

仅展示**百分比**，不重复下方已列出的绝对数量。

| 语言 | 文案示例 |
|------|----------|
| zh | 已用 {{usedPercent}}% · 剩余 {{remainPercent}}%{{#expiredPercent}} · 过期 {{expiredPercent}}%{{/expiredPercent}} |
| en | Used {{usedPercent}}% · Remaining {{remainPercent}}%{{#expiredPercent}} · Expired {{expiredPercent}}%{{/expiredPercent}} |

示例：`已用 57% · 剩余 43%`（Seedance 2.0：2,825,048 / 5,000,000）。

i18n key：`pages.aiInterfaces.volcano.usageBarTooltip`

**无障碍：** `aria-label` 与 Tooltip 文案一致（百分比摘要）；绝对数量由下方四行 + `aria-describedby` 承担。

### 2.3 用量数字格式化（进度条下方四行）

**规则：** 仅对 `unit === "tokens"` 且 **数值 ≥ 1,000,000** 时，以 **百万 tokens** 为单位展示；其余保持原样。

| 条件 | 展示 | 示例（zh） |
|------|------|------------|
| `tokens` 且 `value >= 1_000_000` | `value / 1_000_000`，保留 **最多 2 位小数**，去尾零 | `2,825,048` → `2.83 百万 tokens` |
| `tokens` 且 `value < 1_000_000` | `toLocaleString()` + `tokens` | `873,000` → `873,000 tokens` |
| `images`（张） | 整数 + `张`，**不**做百万换算 | `50` → `50 张` |
| `expired === 0` | 仍显示「过期 0 …」（与控制台一致） | `过期 0 百万 tokens` 或 `过期 0 tokens`（<100万时用 tokens） |

**实现建议（`formatVolcanoUsageAmount`）：**

```ts
const MILLION = 1_000_000;

function formatVolcanoUsageAmount(
  value: number,
  unit: "tokens" | "images" | "seconds",
  locale: "zh" | "en"
): string {
  if (unit === "images") {
    return `${value.toLocaleString()} ${unitLabelImages}`;
  }
  if (unit === "tokens" && Math.abs(value) >= MILLION) {
    const millions = value / MILLION;
    const formatted = millions.toLocaleString(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    return locale === "zh"
      ? `${formatted} 百万 tokens`
      : `${formatted}M tokens`;
  }
  return `${value.toLocaleString(locale)} tokens`;
}
```

**边界：**

- 四行（已用 / 过期 / 剩余 / 总共）**统一**走同一格式化函数，避免同一卡片内单位不一致。
- API 仍返回原始整数；仅 UI 层换算，不改 `VolcanoModelUsage` 字段类型。
- Tooltip **不**使用百万单位（仅 %）；明细行使用百万单位。

**i18n：**

| key | zh | en |
|-----|----|----|
| `usageUnit.millionTokens` | 百万 tokens | M tokens |
| 现有 `packageUsed` 等 | 保持 `已用 {{used}}` 占位，由 formatter 填入已格式化字符串 | 同左 |

**单测（Vitest，`format-volcano-usage-amount.test.ts`）：**

| 输入 | 期望 |
|------|------|
| `2_825_048`, tokens, zh | `2.83 百万 tokens` |
| `500_000`, tokens | `500,000 tokens` |
| `5_000_000`, tokens | `5 百万 tokens` |
| `50`, images | `50 张` |

---

## 3. 面板头部布局（`volcano-interface-panel.tsx`）

### 3.1 信息顺序（自上而下）

```
1. 接口名称（用户命名，见 §6）
2. ★ 账户余额（重点，见 §3.2）
3. 计费扣款提示（billingOverageHint）
4. 资源包购买引导 + 定价文档链接
5. （删除）临时密钥 apiKeyStatus 行
6. 未展开时：expandHint（可选缩短为「展开查看模型用量」）
```

### 3.2 账户余额重点展示

**现状：** `text-sm text-muted-foreground`，排在计费提示之后，弱对比。

**方案：**

```tsx
// 名称下第一行
<p className="text-lg font-semibold tabular-nums tracking-tight">
  ¥ {formatBalance(available)}
</p>
<p className="text-muted-foreground text-xs">
  {t("pages.aiInterfaces.volcano.accountBalance")}
</p>
```

| 状态 | 展示 |
|------|------|
| 有余额 | 大号金额 + 小字标签 |
| 无 snapshot | 不显示金额行，或显示「展开后更新余额」 |
| `balanceError` | 金额位显示 `balanceUnavailable` + 错误摘要（destructive xs） |

**加载时机（二选一，推荐 B）：**

| 选项 | 说明 |
|------|------|
| A | 面板挂载即拉 Snapshot（余额+用量一次到位，多 4 次 billing 分页） |
| **B（推荐）** | 首次「展开」时拉 Snapshot；余额在展开后立即可见并置顶 |

未展开时不展示余额数字，避免空白误导。

### 3.3 删除临时密钥行

移除整块：

```tsx
{t("pages.aiInterfaces.volcano.apiKeyStatus", { masked, expiresAt })}
```

以及未展开时依赖 snapshot 的 `expandHint` 与 apiKey 二选一逻辑。

**保留：** 后端仍自动续期 Ark Key；用户无需感知 masked / 过期日。

可删除或保留 i18n key `apiKeyStatus`（无引用后清理）。

---

## 4. 开通检测逻辑梳理（防偶发误判）

### 4.1 现状与 Seedream 5.0 Pro 案例

| 模型 | 资源包映射 | 本账号包 | 探针 | 当前 UI |
|------|------------|----------|------|---------|
| `doubao-seedream-5-pro` | 有 `ConfigurationCode` | ❌ 无 | 需 `open` | 无包 → **按量计费**；探针 `open` → 无「未开通」徽章 ✅ |
| `doubao-seed-evolving` | 映射表 `[]` | ❌ | 需 `open` | 包通道不参与；仅靠探针 ✅ |
| `doubao-seedance-2-mini` | 有 | ❌ | `not_open` | 包通道 + 探针一致 → 未开通 ✅ |

**风险点：** `resolveVolcanoEffectiveActivationStatus` 在 **探针未跑**（`probe === null`）且 **有映射但无包** 时，一律返回 `not_open`：

```ts
// apps/api/src/integrations/volcengine/resolve-volcano-activation.ts
if (!params.packageSnapshot?.provisioned) {
  return "not_open";  // ← seedream-5-pro 若未探针会被误判
}
```

Seedream 5.0 Pro **已开通但无免费包** 时，若用户未点「检测开通」，会被当成未开通并 **阻止 Toggle**——与「当前显示正确」矛盾，说明该账号多半 **已缓存探针 `open`**；属偶发可行，非稳态。

### 4.2 产品语义：三类模型

在 `packages/types` 增加包通道策略（示例）：

```ts
export type VolcanoPackageProvisionMode =
  | "required"   // 无 Effective 包 ⇒ 高概率未开通（有映射、控制台开通即发包）
  | "optional"   // 可无包仍已开通（按量）；包通道不推断 not_open
  | "none";      // 不参与包通道（映射为空）

export const VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID = {
  "deepseek-v4-pro": "required",
  "deepseek-v4-flash": "required",
  "doubao-seedance-2": "required",
  "doubao-seedance-2-fast": "required",
  "doubao-seedance-2-mini": "required",
  "doubao-seedream-5": "required",
  "doubao-seedream-5-pro": "optional",  // ★ 关键
  "doubao-seed-evolving": "none",
} as const;
```

### 4.3 合并规则（修订版）

| 探针 | 模式 | 有 Effective 包 | 综合 `status` | Toggle |
|------|------|-----------------|---------------|--------|
| `open` | * | * | `open` | 允许 |
| `not_open` / `service_not_open` | * | * | 同探针 | **阻止** |
| `null` | `required` | 否 | `not_open` | **阻止** |
| `null` | `required` | 是 | `unknown` | 允许（建议展示「未检测」） |
| `null` | `optional` | 否 | `unknown` | **允许**；用量显示按量计费 |
| `null` | `optional` | 是 | `unknown` | 允许 |
| `null` | `none` | * | `null` | 允许；**必须**探针或向导检测后才显示已开通 |

**原则：**

1. **探针始终优先**（与 [volcano-model-activation-probe-plan.md](./volcano-model-activation-probe-plan.md) 一致）。
2. **包通道仅对 `required` 模型**在探针缺失时推断 `not_open`。
3. **`optional` 永不因无包判未开通**（覆盖 Seedream 5.0 Pro）。
4. **Toggle 启用前**仍执行单模型探针（现有逻辑）；包通道只影响 **徽章与未探针时的默认禁用**。

### 4.4 UI 与 `unknown` 状态

| 综合状态 | 徽章 | 用量 |
|----------|------|------|
| `open` | 无（或可选「已开通」outline） | 有包 → 进度条；无包 → 按量计费 |
| `not_open` | 未开通 | 不强调用量 |
| `unknown` | 无或「待检测」outline | 有包 → 进度条；无包 → 按量计费 |

**不**对 `optional` + 无包 + `unknown` 显示「未开通」。

### 4.5 实现触点

| 文件 | 变更 |
|------|------|
| `packages/types/src/volcano-package-catalog.ts` | 增加 `VolcanoPackageProvisionMode` + 表 |
| `resolve-volcano-activation.ts`（api + app 同步） | 按 mode 分支 |
| `volcengine-parsers.test.ts` | 用例：`seedream-5-pro` 无包 + probe null → 非 `not_open` |
| `volcano-model-row.tsx` | `unknown` 时不显示未开通引导文案 |

### 4.6 防回归检查清单

| 模型 | 探针 | 包 | 期望 |
|------|------|-----|------|
| seedream-5-pro | `open` | 无 | 按量计费，可启用 |
| seedream-5-pro | `null` | 无 | 按量计费，**可**启用（optional） |
| seedream-5-pro | `not_open` | 无 | 未开通，阻止 |
| seedance-2-mini | `null` | 无 | 未开通（required） |
| seedream-5 | `null` | 有 | unknown，可启用 |
| evolving | `null` | — | 无包推断，需探针确认 |

---

## 5. 产品重命名

### 5.1 展示文案

| 场景 | 现文案 | 新文案 |
|------|--------|--------|
| 模板名（seed） | 火山方舟 | **火山引擎-火山方舟-字节跳动旗下** |
| 向导默认接口名 | 火山方舟 | 同上（可截短为用户可编辑） |
| 向导标题 zh | 接入火山方舟 | 接入火山引擎-火山方舟 |
| empty / description | 火山方舟 | 按语境替换，长名用于模板与卡片标题 |

**英文（en）：**  
`Volcengine · Ark (ByteDance)` 或 `Volcengine Ark — ByteDance`（不必直译「旗下」）。

### 5.2 集中常量（推荐）

```ts
// packages/types/src/volcano-branding.ts
export const VOLCANO_PRODUCT_DISPLAY_NAME_ZH =
  "火山引擎-火山方舟-字节跳动旗下" as const;
export const VOLCANO_PRODUCT_DISPLAY_NAME_EN =
  "Volcengine Ark (ByteDance)" as const;
```

引用处：

| 文件 | 字段 |
|------|------|
| `apps/api/src/ai-interface/bootstrap-seeds.ts` | `meta.name` |
| `volcano-wizard-dialog.tsx` | 默认 `name` state |
| `i18n` zh/en | `wizardTitle`、`empty`、`pages.aiInterfaces.description` 等 |
| 可选 | `organization-ai-interfaces-page` 用模板名而非用户 `iface.name` 作副标题 |

**不改：** `VOLCANO_TEMPLATE_ID`、`provider`、API 路由、数据库 `template_id`。

### 5.3 数据库已有接口

已保存的 `organization_ai_interfaces.name` 仍为用户当时填写的「火山方舟」，**不批量迁移**；仅新向导默认值与模板 catalog 名更新。用户可在接口设置中自行改名。

---

## 6. 分阶段实施

### Phase 1 — 用量与面板（低风险）

- [ ] 移除 `packageName`（类型 + UI + 聚合）
- [ ] 双色进度条 + Tooltip（**仅百分比**）
- [ ] `formatVolcanoUsageAmount`：token ≥100 万 → 百万 tokens
- [ ] 进度条下方保留四行明细（已用/过期/剩余/总共）
- [ ] 面板：余额置顶强调、删除 apiKey 行、调整文案顺序
- [ ] i18n：`usageBarTooltip`、`usageUnit.millionTokens`

### Phase 2 — 开通检测加固

- [ ] `VolcanoPackageProvisionMode` + `seedream-5-pro` = `optional`
- [ ] 修订 `resolveVolcanoEffectiveActivationStatus`（api/app）
- [ ] 单测 + 手动验证 §4.6 表

### Phase 3 — 品牌重命名

- [ ] `volcano-branding.ts` + bootstrap seed + wizard 默认值
- [ ] i18n 批量替换用户可见「火山方舟」为规范名称

---

## 7. 文件索引（拟改）

```
packages/types/src/
  volcano-snapshot.ts          # 移除 packageName
  volcano-package-catalog.ts   # + provisionMode
  volcano-branding.ts          # 新增

apps/api/src/integrations/volcengine/
  aggregate-package-usage.ts
  resolve-volcano-activation.ts

apps/app/src/
  pages/organization-ai-interfaces/volcano-usage-meter.tsx
  pages/organization-ai-interfaces/format-volcano-usage-amount.ts  # 新增
  pages/organization-ai-interfaces/format-volcano-usage-amount.test.ts
  pages/organization-ai-interfaces/volcano-interface-panel.tsx
  pages/organization-ai-interfaces/volcano-model-row.tsx
  utils/volcano-activation.ts
  i18n/locales/zh.ts / en.ts

apps/api/src/ai-interface/bootstrap-seeds.ts
apps/app/.../volcano-wizard-dialog.tsx
```

---

## 8. 风险

| 风险 | 缓解 |
|------|------|
| `required` 模型漏配 mode | 默认 `required` 仅用于映射表内显式列出的 id |
| 进度条三色过杂 | 过期为 0 时不画第三段 |
| 品牌名过长挤布局 | 名称区 `truncate` + `title` 全名；移动端可换行 |
| 百万换算精度 | 统一 2 位小数、去尾零；5,000,000 显示为 `5 百万 tokens` |
| optional 未探针即可启用 | Toggle 时仍强制单模型探针（现有） |

---

## 9. 结论

1. **去掉包名展示**，避免多包聚合误导。  
2. **进度条**已用/剩余双色；**hover 仅百分比**；**绝对数量仍在条下四行**（token ≥100 万用 **百万 tokens**）。  
3. **Seedream 5.0 Pro** 定为 `optional` 包策略，无包不推断未开通；探针仍为权威。  
4. **隐藏临时密钥行**；**余额**在名称下第一行强调。  
5. **产品名**统一为「火山引擎-火山方舟-字节跳动旗下」（模板/向导/i18n）。
