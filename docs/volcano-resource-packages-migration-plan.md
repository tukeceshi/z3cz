# 火山方舟用量改造方案：GetInferenceUsage → billing ListResourcePackages

> 日期：2026-07-11（全量列表实测更新）  
> 状态：**方案已定 + 全量 API 已跑通**（未实现代码）  
> 官方文档：[ListResourcePackages](https://docs.volcengine.com/docs/6269/1337079?lang=zh)  
> 全量探测输出：[billing-full-list-probe.txt](./billing-full-list-probe.txt)  
> 关联：[volcano-model-activation-probe-plan.md](./volcano-model-activation-probe-plan.md)

---

## 1. 目标

| 能力 | 数据源 |
|------|--------|
| 用量进度条 / 剩余额度（**仅包内**） | `billing/ListResourcePackages` |
| **账户余额** | `billing/QueryBalanceAcct` |
| 模型是否「已开通」（辅助） | 全量包列表 + `ConfigurationCode` 映射 |
| 模型是否「已开通」（主路径，保留） | 推理 API 最小探针 `ModelNotOpen`（**不删除**） |

**不再**用 `ark/GetInferenceUsage`。  
**不再**统计或展示「超出免费/资源包额度」的按量用量（无 API 且无产品需求）；超额部分仅通过 **账户余额** 体现扣费能力。

---

## 2. API 调用规范（已验证）

| 项 | 值 |
|----|-----|
| Host | `billing.volcengineapi.com` |
| Service / Version | `billing` / `2022-01-01` |
| Action | `ListResourcePackages` |
| `ResourceType` | `"Package"`（另有 `RI` / `RSC`） |
| `MaxResults` | **`"20"`（字符串，上限 20）** |
| 分页 | `NextToken`，末页为 `"0"` |

本测试账号：**4 页 / 55 条 / 全部 `Status=Effective`**。

### 2.1 账户余额（`QueryBalanceAcct`）

| 项 | 值 |
|----|-----|
| Host / Service / Version | 同上 `billing` / `2022-01-01` |
| Action | `QueryBalanceAcct` |
| Body | `{}` |
| 主字段 | `AvailableBalance`（展示）、`CashBalance`（次要） |

与 `ListResourcePackages` 共用 billing 签名客户端；Snapshot 每次刷新各调用 1 次。

---

## 3. 全量拉取策略

### 3.1 必须全量拉取后在客户端匹配

**不支持**按模型名在服务端精准过滤（下列参数实测均返回 **完整 55 条**，与无过滤相同）：

| 尝试参数 | 结果 |
|----------|------|
| `ConfigurationName`（精确 / 模糊） | ❌ 无效，仍 55 条 |
| `ModelName` | ❌ 无效 |
| `FoundationModelName` | ❌ 无效 |
| `Keyword` | ❌ 无效 |
| `Filter.ConfigurationName` | ❌ 无效 |
| `InstanceName` | ❌ 无效 |

**唯一有效的服务端缩窄**：`Product`（产品 code）

| Product | 本账号条数 |
|---------|-----------|
| `ark_bd` | 34 |
| `ark_open_source_llm` | 11 |
| `Doubao-image-generation` | 4 |
| `Doubao-Seedream` | 1 |
| 其他 | 5 |

实现建议：

```
1. Snapshot 刷新时：ResourceType=Package, MaxResults="20", Status=Effective
2. 循环 NextToken 直至结束（本账号 4 次）
3. 在内存中按 ConfigurationCode 映射到 catalog
4. 同一 canonicalId 命中多包 → 叠加聚合（§5）
```

可选优化（仍须合并去重）：按已知 `Product` 分 4 次拉取，但 catalog 跨 Product（DeepSeek 在 `ark_open_source_llm`），**推荐单次全量**更简单可靠。

### 3.2 客户端匹配：精确为主，模糊仅作兜底

| 优先级 | 方式 | 说明 |
|--------|------|------|
| 1 | **`ConfigurationCode` 精确匹配** | 映射表主键，无歧义 |
| 2 | `ConfigurationName` 规范化后匹配 | 去掉「免费在线推理资源包」后缀 |
| 3 | 模糊子串 | **高风险**，仅未配置映射时 |

**反例（禁止单独用 `mini` 模糊）**：

- 搜索 `mini` 会命中 `Doubao_Seed_2.0_mini_free_infer_res_pack`（Seed **2.0-mini** 文本模型）
- **不会**命中 `doubao-seedance-2-mini`（全列表中 **不存在** Seedance 2.0 mini 包）

---

## 4. Catalog 8 模型 — 全量核对结果

| canonicalId | 资源包 | ConfigurationCode | Product | 剩余/总量 | 单位 | 开通推断 |
|-------------|--------|-------------------|---------|-----------|------|----------|
| `deepseek-v4-pro` | ✅ | `DeepSeek_V4_pro_free_inference_resource_pack` | `ark_open_source_llm` | 499,940 / 500,000 | token | 已开通 |
| `deepseek-v4-flash` | ✅ | `DeepSeek_V4_flash_free_inference_resource_pack` | `ark_open_source_llm` | 499,818 / 500,000 | token | 已开通 |
| `doubao-seedance-2` | ✅ | `Doubao_Seedance_2.0_pack_free_infer` | `ark_bd` | 2,174,952 / 2,262,252 | token | 已开通 |
| `doubao-seedance-2-fast` | ✅ | `Doubao_Seedance_2.0_fast_pack_free_infer` | `ark_bd` | 4,912,700 / 5,000,000 | token | 已开通 |
| **`doubao-seedance-2-mini`** | **❌ 无** | — | — | — | — | **未开通（与推理探针一致）** |
| `doubao-seedream-5` | ✅ | `Doubao_Seedream_5.0_pack_free_infer` | `Doubao-Seedream` | 50 / 50 | 张 | 已开通 |
| **`doubao-seedream-5-pro`** | **❌ 无** | — | — | — | — | **未开通（与推理探针一致）** |
| **`doubao-seed-evolving`** | **❌ 无** | — | — | — | — | **未开通（与推理探针一致）** |

说明：

- `doubao-seedream-5` 对应包名为 **「Seedream-5.0-Lite」**，不是 Pro；Pro 无独立免费包或未开通。
- DeepSeek 包在 **`ark_open_source_llm`**，不在 `ark_bd`；映射表必须带 `Product` 或仅依赖 `ConfigurationCode`。

### 4.1 静态映射表（实现时写入 `packages/types`）

```ts
export const VOLCANO_PACKAGE_CONFIG_BY_CANONICAL_ID = {
  "deepseek-v4-pro": ["DeepSeek_V4_pro_free_inference_resource_pack"],
  "deepseek-v4-flash": ["DeepSeek_V4_flash_free_inference_resource_pack"],
  "doubao-seedance-2": ["Doubao_Seedance_2.0_pack_free_infer"],
  "doubao-seedance-2-fast": ["Doubao_Seedance_2.0_fast_pack_free_infer"],
  "doubao-seedance-2-mini": ["Doubao_Seedance_2.0_mini_pack_free_infer"], // 预留；本账号无实例
  "doubao-seedream-5": ["Doubao_Seedream_5.0_pack_free_infer"],
  "doubao-seedream-5-pro": ["Doubao_Seedream_5.0_pro_pack_free_infer"], // 预留；本账号无实例
  "doubao-seed-evolving": [], // 无免费包产品码已知
} as const;
```

`doubao-seedance-2-mini` 的 ConfigurationCode **按命名惯例预留**；全量列表中 **0 条** 匹配，可确认该账号未发放此包。

---

## 5. 同一模型多包叠加

同一 `canonicalId` 可命中 **0~N** 条 `List`（多条免费包、续期包、不同 `InstanceNo`）。

聚合规则（仅 `Status === "Effective"` 参与用量条）：

```ts
quota     = Σ Number(row.TotalAmount)
remaining = Σ Number(row.AvailableAmount)
used      = quota - remaining
usagePercent = quota > 0 ? round(remaining / quota * 100) : null
```

约束：

- 叠加前检查 **`Unit` 一致**（token 与 张 不可混加）
- `Unit === "张"` → `VolcanoModelUsage.unit = "images"`
- 若单位不一致 → `usageError`，不画条

本账号 catalog 8 模型均为 **每模型 0 或 1 包**；叠加逻辑仍须实现以备续费/多实例。

---

## 6. 用量展示范围与 UI 分工

### 6.1 只统计「包内」用量（核心产品决策）

资源包 / 免费额度是 **有上限的递减池**；超出后火山按量计价并 **直接从账户余额扣款**，平台侧 **不拉取、不展示** 超额用量。

| 展示 | 是否保留 | 说明 |
|------|----------|------|
| 包内 `remaining` / `quota` | ✅ | 来自 `AvailableAmount` / `TotalAmount` |
| 包内 `used`（= quota − remaining） | ✅ | 仅表示已消耗的包内额度 |
| 进度条（剩余 %） | ✅ | `remaining / quota`，上限 100% |
| **`paidUsed` / 按量已用** | ❌ **删除** | 原 `GetInferenceUsage` + `BillingStatus=paid` 路径废弃 |
| **`meteredUsage` 行** | ❌ **删除** | `volcano-usage-meter.tsx` 不再展示 |
| 超额 token/张数统计 | ❌ | 无数据源且不要求 |

包用尽时（`remaining === 0`）：

- 进度条 0%，文案「额度已用尽」
- **不**显示「按量已用 X tokens」
- 引导用户查看面板顶部 **账户余额** 与计费说明（§6.3）

无资源包、已开通模型：

- 不画进度条
- 文案「按量计费」+ 定价 Popover（价格参考，不展示实时用量）

### 6.2 模型行字段分工

| UI | 字段 |
|----|------|
| 进度条 | `AvailableAmount` / `TotalAmount`（包内） |
| 主文案 | `remaining` + `Unit` |
| 次要行 | 包内 `used` / `quota`（可选） |
| 包名 | `ConfigurationName` |
| 无包 | 「按量计费」（无用量数字） |

**移除**（实现时从类型与组件删除）：

- `VolcanoUsageBreakdown.paidUsed` / `freeUsed` / `paidQuota`
- `aggregate-volcano-usage` 中 `BillingStatus` 拆分逻辑

### 6.3 账户余额展示

#### API（与资源包同 billing 服务）

| 项 | 值 |
|----|-----|
| Action | `QueryBalanceAcct` |
| Body | `{}`（无必填参数，见 Go SDK） |
| 响应字段 | `AvailableBalance`、`CashBalance`、`ArrearsBalance`、`FreezeAmount` 等 |

映射到现有 `VolcanoSnapshotResponse.balance`（类型已存在）：

```ts
balance: {
  available: AvailableBalance,  // 主展示：可用余额
  cash: CashBalance,            // 现金余额（次要）
  currency: "CNY",
} | null
```

`query-balance.ts` 当前为 **stub（返回 null）**；实现时走 `billing-client`，与 `ListResourcePackages` 共用 AK/SK 签名。

#### UI 位置（`volcano-interface-panel`）

展开 Snapshot 后，在 **模型列表上方**、**计费说明/定价链接之前** 增加一行：

```
账户余额：¥ {available}   （拉取失败时显示 balanceError）
```

与 API Key 状态并列或单独一行，刷新 Snapshot 时一并更新。

### 6.4 计费说明前提示（面板顶部）

在现有「资源包 / 定价文档」文案 **之前**（或合并为同一块说明区），增加固定提示：

| 语言 | 文案（i18n key 建议） |
|------|----------------------|
| zh | 超过免费和资源包额度后，计价将**直接从账户余额**扣费。 |
| en | Usage beyond free quota and resource packages is charged directly against your account balance. |

布局顺序（自上而下）：

1. 接口名称  
2. **计费扣款提示**（§6.4，新增）  
3. **账户余额**（§6.3，新增）  
4. 资源包购买引导 + 定价文档链接（现有 `resourcePackHint`）  
5. API Key 状态  
6. 模型 masonry 列表  

定价 Popover（每模型行）仍只展示 **单价说明**，不含实时按量用量。

#### i18n（`apps/app/src/i18n/locales/`）

| key | zh | en |
|-----|----|----|
| `volcano.billingOverageHint` | 超过免费和资源包额度后，计价将直接从账户余额扣费。 | Usage beyond free quota and resource packages is charged directly against your account balance. |
| `volcano.accountBalance` | 账户余额 | Account balance |
| `volcano.balanceUnavailable` | 余额暂不可用 | Balance unavailable |
| `volcano.quotaExhausted` | 额度已用尽 | Quota exhausted |
| `volcano.packageRemaining` | 剩余 {remaining} {unit} | {remaining} {unit} remaining |

实现时删除或停用：`volcano.meteredUsage` 等与按量用量相关的 key。

---

## 7. 开通状态：双通道（资源包 + 推理探针）

### 7.1 设计原则

| 通道 | 保留 | 作用 |
|------|------|------|
| **A. 推理最小探针** | ✅ **保留，不删** | 权威：`ModelNotOpen` / `InvalidParameter` |
| **B. 资源包存在性** | ✅ **新增辅助** | 全量 `List` 后按 `ConfigurationCode` 判断是否有 `Effective` 包 |

探针实现与 taxonomy 见 [volcano-model-activation-probe-plan.md](./volcano-model-activation-probe-plan.md)，**本方案不替代、不删除**。

### 7.2 资源包通道判定

```ts
provisionedByPackage =
  matchedEffectivePackages(canonicalId).length > 0;
```

| `provisionedByPackage` | 含义 |
|------------------------|------|
| `true` | 至少有一条生效中的免费/资源包绑定该模型配置 |
| `false` | 全量列表中无对应 `ConfigurationCode`（**高概率未在控制台开通**） |

### 7.3 合并策略（Snapshot `activation` 字段）

```ts
interface ModelActivationView {
  /** 推理探针结果（主，保留原逻辑） */
  readonly probe: ModelActivationProbeResult | null;
  /** 资源包通道（辅） */
  readonly package: {
    readonly provisioned: boolean;
    readonly matchedCodes: readonly string[];
    readonly instanceNos: readonly string[];
  };
  /** UI 用综合状态 */
  readonly status: "open" | "not_open" | "unknown";
}
```

综合规则：

| probe | package.provisioned | `status` | UI |
|-------|-------------------|----------|-----|
| `open` | `true` | `open` | 正常 |
| `open` | `false` | `open` | 按量已开通但无免费包（少见） |
| `not_open` | `false` | **`not_open`** | **强一致**（mini / evolving / seedream-pro 本账号） |
| `not_open` | `true` | `not_open` | 以 probe 为准，包可能为历史残留 |
| `null`（未探针） | `false` | `not_open` | 仅包判断：显示未开通 |
| `null` | `true` | `unknown` | 建议补探针或显示「已分配额度」 |

**Toggle 禁用**：`status === "not_open"`（与现方案一致）；资源包通道可在 **未跑探针** 时提前禁用 mini 等。

### 7.4 本账号核对（与推理探针交叉验证）

| 模型 | 资源包 | 预期探针 |
|------|--------|----------|
| `doubao-seedance-2-mini` | ❌ | `ModelNotOpen` |
| `doubao-seed-evolving` | ❌ | `ModelNotOpen` |
| `doubao-seedream-5-pro` | ❌ | 未开通 |
| `doubao-seedance-2` | ✅ | `InvalidParameter` / open |

---

## 8. 架构（计划，未实现）

```
Snapshot refresh
  ├─ billing: ListResourcePackages × N 页（全量）
  │     → parse → index by ConfigurationCode
  │     → aggregate per canonicalId（仅包内 remaining/quota/used）
  │     → provisioned map（开通辅助）
  ├─ billing: QueryBalanceAcct（1 次）
  │     → snapshot.balance
  ├─ ark: ensure API Key（不变）
  └─ inference: probe-activation（保留，可选懒加载）
        → 与 package 合并 → activation.status
```

移除：

- `GetInferenceUsage` 于 Snapshot 路径  
- 按量用量聚合、`paidUsed` / `meteredUsage` UI  

新增模块：`billing-client.ts`、`list-resource-packages.ts`、`parse-resource-packages.ts`、`aggregate-package-usage.ts`、`match-package-provision.ts`、`query-balance.ts`（实现 `QueryBalanceAcct`）。

---

## 9. 分阶段实施

### Phase 0 — ✅ 完成

- [x] 全量 55 条拉取与存档
- [x] 确认服务端无法按模型名过滤
- [x] 确认 `doubao-seedance-2-mini` 无包
- [x] 确认多 Product 分布
- [x] 双通道开通方案

### Phase 1 — 后端

- [ ] 全量分页 + `ConfigurationCode` 索引
- [ ] 多包叠加 + 单测（fixture 来自 `billing-full-list-probe.txt`）
- [ ] `package.provisioned` 与 probe 合并
- [ ] Snapshot 切换用量数据源（**仅包内字段**）
- [ ] 实现 `QueryBalanceAcct` → `snapshot.balance`
- [ ] 删除 Snapshot 对 `paid`/按量用量的解析与字段

### Phase 2 — 前端

- [ ] 进度条 = 包内 remaining%
- [ ] **移除** `meteredUsage` / `paidUsed` 展示
- [ ] 面板顶：计费扣款提示 + 账户余额
- [ ] 未开通：probe `not_open` **或** `!package.provisioned`
- [ ] 保留探针按钮 / 向导探针

### Phase 3 — 清理

- [ ] 移除 Snapshot 对 `GetInferenceUsage` 的依赖
- [ ] **保留** `probe-model-activation.ts` 及路由

---

## 10. 风险

| 风险 | 缓解 |
|------|------|
| 模糊匹配误伤（如 `mini`） | **禁止**；仅 `ConfigurationCode` 精确表 |
| 开通仅按量、无免费包 | `package=false` 但 `probe=open` → 仍视为已开通；仅显示「按量计费」无用量数 |
| 用户不知超额扣费方式 | 面板顶固定提示（§6.4）+ 余额可见 |
| 全量 4 次调用限流 | Snapshot 缓存；请求间隔 ≥350ms |
| ConfigurationCode 变更 | 映射表集中维护 + `usageError` 告警 |
| 包通道误判未开通 | probe 主路径保留；冲突以 probe 为准 |
| `QueryBalanceAcct` 权限不足 | `balanceError` 展示，不阻塞包用量 |

---

## 11. 复现

```bash
docker compose run --rm \
  -e VOLC_AK="..." -e VOLC_SK="..." \
  dev sh -c "cd /app/apps/api && npx tsx scripts/probe-billing-full-list.ts"
```

输出同步至 `docs/billing-full-list-probe.txt`。

---

## 12. 结论摘要

1. **必须全量拉取** + 客户端 `ConfigurationCode` 精确匹配；API **不能**按模型名有效过滤。  
2. **同一模型多包**应对 `TotalAmount` / `AvailableAmount` **求和**（仅包内）。  
3. **超出资源包/免费额的按量用量不统计、不展示**；超额扣费通过 **账户余额** 体现。  
4. **账户余额**：`QueryBalanceAcct` 写入 `snapshot.balance`，面板顶展示。  
5. **计费说明前提示**：「超过免费和资源包额度后，计价直接扣余额」。  
6. **`doubao-seedance-2-mini` 无资源包**，与「未启用」一致；开通判断保留推理探针 + 包存在性辅助。  
7. **DeepSeek** 在 `ark_open_source_llm`；**Seedream 5** 在 `Doubao-Seedream`（Lite 50 张）。
