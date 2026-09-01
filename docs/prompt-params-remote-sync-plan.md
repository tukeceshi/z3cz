# Prompt / 节点参数跨端正常同步

> 状态：待确认，**未执行**

## 目标

另一 tab 改了 **prompt 或其它 `inputs` 参数** 后，本 tab **正常显示远程值**。

**不改**：视口防抖、维护 public 层、generativeDefaults、生成中 metadata、选中态、时间戳过滤等现有逻辑。

## 根因（两处）

1. **`keepLocalInputValues`**（[`use-graph-operations.ts`](apps/app/src/components/workflow/use-graph-operations.ts)）  
   远程图进来后，凡本地 **非空** 的 input 一律保留本地 → prompt / 模型参数等被盖住。

2. **`isLocalGraphDirty()` 挡住 `patch_graph`**（[`use-editable-workflow.ts`](apps/app/src/hooks/use-editable-workflow.ts)）  
   本地有任何未保存图变更 → **整包 patch 丢弃**，参数更新也进不来。

## 改法

### 1. 去掉「本地 input 优先」

- 删除 `keepLocalInputValues` 及其在 `initialNodes` 同步里的调用。
- 远程 `setNodes` / `applyBackendGraphToEditor` 后，**inputs 以远程为准**（与其它已正常同步的字段一致）。

### 2. `patch_graph` 不再因 dirty 整包丢弃

- `onPatchGraph`：去掉 `isLocalGraphDirty()` 提前 return。
- 仍保留：时间戳过旧、维护冻结等现有判断。
- patch 继续基于 `lastSentGraphRef` 合并后 `applyBackendGraphToEditor`（现有路径不变）。

### 3. 文本框（可选，本方案含）

- [`use-buffered-text-value.ts`](apps/app/src/components/workflow/use-buffered-text-value.ts)：远程 `externalValue` 变化时，**未在 IME 组字** 则更新本地显示（含失焦前与聚焦中，避免 prompt 框挡住同步）。
- 正在组字（`composingRef`）仍不打断。

## 涉及文件

| 文件 | 改动 |
|------|------|
| [`use-graph-operations.ts`](apps/app/src/components/workflow/use-graph-operations.ts) | 删 `keepLocalInputValues` |
| [`use-editable-workflow.ts`](apps/app/src/hooks/use-editable-workflow.ts) | `onPatchGraph` 去 dirty 拦截 |
| [`use-buffered-text-value.ts`](apps/app/src/components/workflow/use-buffered-text-value.ts) | 远程值跟进（非组字时） |
| 测试 | 远程 input 覆盖本地非空 prompt；dirty 时 patch 仍生效 |

## 验收

1. 两 tab 开同一工作流：A 改节点 prompt → B 底部框内容跟着变。  
2. A 改模型参数（分辨率等）→ B 同步。  
3. 本地仅拖了节点未保存时，B 改 prompt → A 仍能看到 prompt 更新（位置冲突另论，本方案不扩 scope）。  
4. 视口 / 维护 / 默认模型行为与改前一致。

## 执行顺序

1. 删 `keepLocalInputValues`  
2. 放宽 `onPatchGraph`  
3. 调整 buffer（非组字跟远程）  
4. 补测试 + 手动双 tab 验收
