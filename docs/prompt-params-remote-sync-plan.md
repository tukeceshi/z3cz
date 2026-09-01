# Prompt 与正常参数同样同步

> 状态：已执行（call site 摘 prompt，`keepLocalInputValues` 原样）

## 问题说清

- **多数 input**：不在「本地非空强制保留」里 → 远程来了 **本来就会更新**。
- **prompt**：被包进 `keepLocalInputValues` → 本地 once 非空就 **一直盖住远程**，表现像「只有 prompt 不同步」。

不是要给 prompt 开「远程优先」特权，而是 **把它从这套本地保护里摘出来**，和本来就会实时更新的参数 **同一条路**。

## 改法（一处调用）

文件：[`use-graph-operations.ts`](apps/app/src/components/workflow/use-graph-operations.ts)

`initialNodes` 同步处（约 752 行）：

**现在**：整包 inputs 进 `keepLocalInputValues`（含 prompt）

**改为**：

1. **prompt** → 直接用远程 `newNode.data.inputs` 里的值  
2. **其余 input** → 仍走 **原样** 的 `keepLocalInputValues`（逻辑不改）

可抽小函数，例如 `mergeNodeInputsFromRemote(incoming, local)`，内部：

```
非 prompt 部分 → keepLocalInputValues（不变）
prompt           → 来自 incoming，不经过 keepLocal
```

`keepLocalInputValues` **函数体不改**（若已有 `prompt` 过滤，执行时 **还原**）。

## 范围

| 做 | 不做 |
|----|------|
| 仅 prompt 退出本地保护 | dirty 拦截 patch、buffer、视口、维护等 |

## 验收

- 两 tab：A 改 prompt → B 底部框更新（远程 patch 能进 editor 的前提下）  
- 改模型参数等 → 与改前一致  

## 执行

1. 新增/替换 merge  helper（call site 层摘 prompt）  
2. 还原 `keepLocalInputValues` 内对 prompt 的特殊 filter（如有）  
3. 双 tab 手动验 prompt  

确认后回复 **「执行」**。
