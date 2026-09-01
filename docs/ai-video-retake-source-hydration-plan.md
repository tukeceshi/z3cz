# 重拍节点：原片资源读取升级方案

> 状态：待确认 · 确认后执行，本文档不含实现

## 背景

主视频已改为「引用口第一个视频」，但**时长、播放 URL、尺寸、裁剪源**仍在多处各自读取、各自写入 `retake_draft`，并与 Toolbar / 截取会话 / 卡片 metadata 混在一起。  
实测：原片 29s，拖动条总长锁在 10s——说明**引用媒体对了，资源生命周期没统一**。

本方案不是修拖动条单点，而是把重拍节点的「原片」收成**一条读取链**。

---

## 目标

**唯一原片来源**：引用口第一个视频（`primaryVideoEdgeId` 锁定边，media 从连线解析）。

**唯一写入点**：原片属性（时长、宽高、播放 URL、loadPhase）只由「原片同步」写入 draft，其它模块只读。

**可响应变化**：主视频引用边变更、源节点输出更新时，自动重新同步并 clamp 选区。

---

## 现状问题（分散读取）

| 模块 | 现在怎么读 | 问题 |
|------|-----------|------|
| `resolveRetakePrimaryVideoRef` | 只返回 media + edgeId | 不含时长/URL，下游各自 probe |
| `video-retake-toolbar-button` | Toolbar 传入的 sourceVideo + trimSeed | **绕过引用**，可写入错误 `videoDurationSec` |
| `ai-video-retake-trim-panel` | 独立 probe + `retakeReady` 短路 | 锁死错误时长，不与引用联动 |
| `canvas-media-cover` | 选中节点时 `<video>.duration` 写 draft | 与 trim panel / toolbar 竞态，常不生效 |
| `ai-video-retake-config-panel` | media 走引用，时长/generate 走 draft | 读写分裂 |
| `run-video-retake-pipeline` | 接收调用方传入的 sourceMedia/URL/duration | 不校验是否与主视频引用一致 |

---

## 升级架构

```
引用口第一个视频（edge + media）
        ↓
  resolveRetakePrimaryVideoRef   ← 认定「谁是原片」
        ↓
  syncRetakePrimaryVideoDraft     ← 唯一：probe 时长/尺寸/URL，写 draft
        ↓
  ┌─────────┬──────────┬──────────┬──────────┐
  拖动条    卡片预览    播放      生成/计价
  （只读）  （只读）   （只读）   （只读 draft + 补充引用）
```

### 新增核心：`syncRetakePrimaryVideoDraft`

职责（输入：nodeId、edges、nodes、org、workflow；输出：patch draft）：

1. 解析主视频引用；无引用 → `loadPhase: error`，清空时长
2. 对主视频 media **强制 probe**（不信任 draft / seed 里的旧 `videoDurationSec`）
3. 写入 `videoDurationSec`、`sourceVideoWidth/Height`、`trimSourceVideoUrl`、`loadPhase: ready`
4. 用新时长 **clamp** `draftRange` / `committedRange`
5. 主视频 media 身份变化（resourceId / edgeId）时整包重跑

挂载点：**一个 hook** `useRetakePrimaryVideoSync(nodeId, data)`，供 bottom panel / widget 使用；Toolbar 创建节点后**不再写时长**。

---

## draft 字段分工（升级后）

| 字段 | 谁写 | 含义 |
|------|------|------|
| `primaryVideoEdgeId` | 创建节点 / 用户不可改 | 哪条边是原片 |
| `videoDurationSec` 等 | **仅 sync** | 原片 probe 缓存 |
| `draftRange` / `committedRange` | 用户拖动 + sync clamp | 选区 |
| `cardPreview` / history 等 | 现有逻辑 | 不变 |

可选：增加 `primaryVideoMediaKey`（resourceId 或 edgeId hash）用于检测 media 是否变了，避免无效重 probe。

---

## 各模块改动（确认后执行）

### 1. 原片同步层（新建/扩展）

- 扩展 [`ai-video-retake-primary-ref.ts`](apps/app/src/components/workflow/ai-video-retake-primary-ref.ts) 或新建 `use-retake-primary-video-sync.ts`
- 新增 `syncRetakePrimaryVideoDraft`（纯函数，可单测）
- 调整 [`video-trim-utils.ts`](apps/app/src/components/workflow/video-trim-utils.ts)：`resolveRetakeVideoDurationSec` 增加 `forceProbe` 或在 sync 路径不传 `knownDurationSec`

### 2. 删除分散写入

| 文件 | 改法 |
|------|------|
| [`video-retake-toolbar-button.tsx`](apps/app/src/components/workflow/video-retake-toolbar-button.tsx) | 只 seed **选区**（来自 trim 会话）；**不写** duration/尺寸/URL |
| [`ai-video-retake-trim-panel.tsx`](apps/app/src/components/workflow/ai-video-retake-trim-panel.tsx) | 去掉本地 probe `useEffect`；只读 draft + 用户改 range |
| [`canvas-media-cover.tsx`](apps/app/src/components/workflow/canvas-media-cover.tsx) | 重拍分支去掉写 `videoDurationSec`；播放仍用 draft URL / cover media |

### 3. 消费者改只读

| 文件 | 改法 |
|------|------|
| [`ai-video-retake-config-panel.tsx`](apps/app/src/components/workflow/ai-video-retake-config-panel.tsx) | 原片 media/URL/时长均来自 draft（由 sync 保证）；generate 前校验 `loadPhase === ready` |
| [`ai-video-retake-trim-panel.tsx`](apps/app/src/components/workflow/ai-video-retake-trim-panel.tsx) | 拖动条 `videoDurationSec` ← draft |
| [`ai-video-node-utils.ts`](apps/app/src/components/workflow/ai-video-node-utils.ts) | 卡片原片态：media 仍走 primary ref（与 draft 一致） |
| [`run-video-retake-pipeline.ts`](apps/app/src/components/workflow/run-video-retake-pipeline.ts) | 入参可收敛为从 draft 读取；或调用方保证三者同源 |

### 4. 挂载 sync

- [`ai-video-retake-bottom-panel.tsx`](apps/app/src/components/workflow/ai-video-retake-bottom-panel.tsx) 或 widget 层调用 `useRetakePrimaryVideoSync`
- 依赖：`primaryVideoEdgeId`、主视频 media key、edges 变化 → 触发 sync

### 5. 补充引用（不变）

- 图片/音频/额外视频：仍走引用口，[`collectRetakeSupplementalReferenceMedia`](apps/app/src/components/workflow/ai-video-retake-primary-ref.ts)
- 生成时：主视频裁剪段 = `<视频1>`，其余引用顺序拼接

---

## 边界

- **主视频引用变更**：re-sync + clamp 选区 + toast 提示
- **源节点被删**：sync 失败 → error 态，禁止生成
- **生成后「重做」**：仍读主视频引用，不读 history
- **旧工作流**：不迁移；无 `primaryVideoEdgeId` 时 fallback 第一个视频边并回写

---

## 测试

- `syncRetakePrimaryVideoDraft`：有/无主视频、probe 成功/失败、时长变化 clamp 选区
- 主视频 media 变更触发 re-sync
- Toolbar 只 seed 选区、不写时长
- 集成：29s 原片 → 拖动条总长 29s（回归实测 bug）

---

## 验收

- [ ] 拖动条总长 = 主视频引用实际时长
- [ ] 创建重拍 / 换源 / 刷新后时长仍正确
- [ ] 代码中无「绕过引用写 duration」的路径（toolbar / trim panel / canvas 三处）
- [ ] 生成、卡片、播放、计价读同一套 draft 缓存

---

## 不在本次范围

- 旧 `retake_source` 工作流迁移（仍不做）
- 非重拍模式（普通视频生成）的引用逻辑
