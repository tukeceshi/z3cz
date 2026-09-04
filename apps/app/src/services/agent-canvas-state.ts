import {
  AI_TEXT_NODE_TYPE,
  getResourceIdFromValue,
  isWorkflowMediaValue,
} from "@dafthunk/types";
import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";

import { readAiTextDisplayExcerptSync } from "@/components/workflow/ai-text-node-utils";
import type {
  WorkflowEdgeType,
  WorkflowNodeType,
  WorkflowParameter,
} from "@/components/workflow/workflow-types";
import {
  capabilityForTool,
  capabilityLabel,
  isToolAllowed,
  lookupAgentTool,
} from "@/services/agent-capabilities";
import {
  type AgentSessionMode,
  hasCapability,
} from "@/services/agent-session-mode";
import { resolveResourceIdsOnServer } from "@/services/resolve-resource-ids-on-server";

export const CANVAS_GET_STATE_TOOL = "canvas_get_state" as const;
export const CANVAS_RESOLVE_RESOURCE_TOOL = "canvas_resolve_resource" as const;
export const CANVAS_WRITE_TEXT_TOOL = "canvas_write_text" as const;
export const CANVAS_RUN_NODE_TOOL = "canvas_run_node" as const;
export const CANVAS_STAGE_MEDIA_TOOL = "canvas_stage_media" as const;
export const REMOTION_OPEN_TOOL = "remotion_open" as const;
export const REMOTION_CLOSE_TOOL = "remotion_close" as const;
export const REMOTION_GET_TOOL = "remotion_get" as const;
export const REMOTION_WRITE_TOOL = "remotion_write" as const;
export const AGENT_CANVAS_EXCERPT_MAX_CHARS = 120;

export interface CanvasAgentNodeSummary {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly resourceId?: string;
  readonly excerpt?: string;
}

export interface CanvasAgentEdgeSummary {
  readonly from: string;
  readonly to: string;
}

export interface CanvasAgentStateSummary {
  readonly nodes: readonly CanvasAgentNodeSummary[];
  readonly edges: readonly CanvasAgentEdgeSummary[];
}

export interface AgentToolCall {
  readonly name: string;
  readonly resourceId: string;
  readonly nodeId: string;
  readonly payload: string;
}

export interface AgentCapabilityHandlers {
  readonly sessionMode: AgentSessionMode;
  readonly consentedCapabilities: readonly string[];
  readonly requestConsent: (capabilityId: string) => Promise<{
    readonly authorized: boolean;
    readonly open: boolean;
  }>;
  readonly revokeConsent: (capabilityId: string) => Promise<{
    readonly authorized: boolean;
    readonly open: boolean;
  }>;
  readonly readSource: () => Promise<string>;
  readonly writeSource: (sourceCode: string) => Promise<{
    readonly ok: boolean;
    readonly compileError?: string;
  }>;
  readonly writeText?: (
    nodeId: string,
    text: string
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  readonly runNode?: (
    nodeId: string
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  readonly stageMedia?: (
    nodeId: string,
    sourceUrl: string,
    mimeType: string
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
}

export function emptyAgentToolCall(): AgentToolCall {
  return { name: "", resourceId: "", nodeId: "", payload: "" };
}

export function truncateAgentCanvasExcerpt(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= AGENT_CANVAS_EXCERPT_MAX_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, AGENT_CANVAS_EXCERPT_MAX_CHARS)}…`;
}

export function firstResourceIdFromNodeData(
  data: WorkflowNodeType
): string | undefined {
  const parameters: readonly WorkflowParameter[] = [
    ...data.inputs,
    ...(data.outputs ?? []),
  ];
  for (const parameter of parameters) {
    const found = resourceIdFromUnknown(parameter.value);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function formatCanvasInventory(
  snapshot: CanvasAgentStateSummary
): string {
  if (snapshot.nodes.length === 0) {
    return "画布清单：空";
  }
  return `画布清单：\n${JSON.stringify(snapshot)}`;
}

export function compactCanvasAgentState(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[],
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[]
): CanvasAgentStateSummary {
  return {
    nodes: nodes.map((node) => {
      const nodeType = node.data.nodeType ?? node.type ?? "";
      const resourceId = firstResourceIdFromNodeData(node.data);
      const excerpt =
        nodeType === AI_TEXT_NODE_TYPE
          ? truncateAgentCanvasExcerpt(readAiTextDisplayExcerptSync(node.data))
          : undefined;
      return {
        id: node.id,
        type: nodeType,
        name: node.data.name,
        ...(resourceId ? { resourceId } : {}),
        ...(excerpt ? { excerpt } : {}),
      };
    }),
    edges: edges.map((edge) => ({
      from: edge.source,
      to: edge.target,
    })),
  };
}

function labeledOnly(payload: string, key: string): string {
  const pattern = new RegExp(`^${key}\\s*[:：]\\s*(.+)$`, "i");
  for (const line of payload.split("\n")) {
    const labeled = line.trim().match(pattern);
    if (labeled?.[1]) {
      return labeled[1].trim();
    }
  }
  return "";
}

function firstLabeledValue(payload: string, key: string): string {
  const payloadLines = payload
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const pattern = new RegExp(`^${key}\\s*[:：]\\s*(.+)$`, "i");
  for (const line of payloadLines) {
    const labeled = line.match(pattern);
    if (labeled?.[1]) {
      return labeled[1].trim();
    }
  }
  if (payloadLines[0] && !/[：:]/.test(payloadLines[0])) {
    return payloadLines[0];
  }
  return "";
}

function restAfterFirstLine(payload: string): string {
  const newlineAt = payload.indexOf("\n");
  if (newlineAt < 0) {
    return "";
  }
  return payload.slice(newlineAt + 1);
}

export function parseAgentToolCall(sideBody: string): AgentToolCall {
  const normalized = sideBody
    .replace(/\r\n/g, "\n")
    .replace(/^\n+/, "")
    .trimEnd();
  const newlineAt = normalized.indexOf("\n");
  const rawName = (
    newlineAt < 0 ? normalized : normalized.slice(0, newlineAt)
  ).trim();
  const name = rawName.replace(/^工具：/, "").trim();
  const payload = newlineAt < 0 ? "" : normalized.slice(newlineAt + 1);
  const resourceId =
    name === CANVAS_RESOLVE_RESOURCE_TOOL
      ? firstLabeledValue(payload, "resourceId")
      : "";
  const nodeId =
    name === CANVAS_WRITE_TEXT_TOOL ||
    name === CANVAS_RUN_NODE_TOOL ||
    name === CANVAS_STAGE_MEDIA_TOOL
      ? firstLabeledValue(payload, "nodeId")
      : "";
  return { name, resourceId, nodeId, payload };
}

export async function executeCanvasAgentTool(params: {
  readonly call: AgentToolCall;
  readonly snapshot: CanvasAgentStateSummary;
  readonly organizationId?: string;
  readonly capabilities?: AgentCapabilityHandlers;
}): Promise<string> {
  const handlers = params.capabilities;
  const catalogTool = lookupAgentTool(params.call.name);
  if (
    catalogTool &&
    handlers &&
    !isToolAllowed(params.call.name, handlers.sessionMode ?? "ask")
  ) {
    if (handlers?.sessionMode === "ask") {
      return JSON.stringify({
        error: "模式：问答，不能读写画布。",
      });
    }
    if (handlers?.sessionMode !== "agent") {
      return JSON.stringify({
        error: "模式：方案，不能制作。先让用户确认方案并执行。",
      });
    }
    return JSON.stringify({
      error: `该工具未启用：${params.call.name}`,
    });
  }

  if (params.call.name === CANVAS_GET_STATE_TOOL) {
    return JSON.stringify(params.snapshot);
  }
  if (params.call.name === REMOTION_OPEN_TOOL) {
    if (!handlers) {
      return JSON.stringify({ error: "无法打开该能力" });
    }
    const capabilityId = capabilityForTool(params.call.name);
    if (!capabilityId) {
      return JSON.stringify({ error: "未知能力" });
    }
    return JSON.stringify(await handlers.requestConsent(capabilityId));
  }
  if (params.call.name === REMOTION_CLOSE_TOOL) {
    if (!handlers) {
      return JSON.stringify({ error: "无法退出该能力" });
    }
    const capabilityId = capabilityForTool(params.call.name);
    if (!capabilityId) {
      return JSON.stringify({ error: "未知能力" });
    }
    return JSON.stringify(await handlers.revokeConsent(capabilityId));
  }
  if (params.call.name === REMOTION_GET_TOOL) {
    if (!handlers) {
      return JSON.stringify({ error: "无法读取" });
    }
    return JSON.stringify({ sourceCode: await handlers.readSource() });
  }
  if (params.call.name === REMOTION_WRITE_TOOL) {
    if (!handlers) {
      return JSON.stringify({ error: "无法写入" });
    }
    const capabilityId = capabilityForTool(params.call.name);
    if (
      !capabilityId ||
      !hasCapability(handlers.consentedCapabilities, capabilityId)
    ) {
      const label = capabilityId ? capabilityLabel(capabilityId) : "该能力";
      return JSON.stringify({ error: `未进入${label}。先打开该能力。` });
    }
    const sourceCode = params.call.payload;
    if (!sourceCode.trim()) {
      return JSON.stringify({ error: "缺少源码" });
    }
    return JSON.stringify(await handlers.writeSource(sourceCode));
  }
  if (params.call.name === CANVAS_WRITE_TEXT_TOOL) {
    const nodeId = params.call.nodeId.trim();
    const text = restAfterFirstLine(params.call.payload).trim();
    if (!nodeId) {
      return JSON.stringify({ error: "缺少 nodeId" });
    }
    if (!text) {
      return JSON.stringify({ error: "缺少文本" });
    }
    if (!handlers?.writeText) {
      return JSON.stringify({ error: "无法写入文字节点" });
    }
    return JSON.stringify(await handlers.writeText(nodeId, text));
  }
  if (params.call.name === CANVAS_RUN_NODE_TOOL) {
    const nodeId = params.call.nodeId.trim();
    if (!nodeId) {
      return JSON.stringify({ error: "缺少 nodeId" });
    }
    if (!handlers?.runNode) {
      return JSON.stringify({ error: "无法运行该节点" });
    }
    return JSON.stringify(await handlers.runNode(nodeId));
  }
  if (params.call.name === CANVAS_STAGE_MEDIA_TOOL) {
    const nodeId = params.call.nodeId.trim();
    const sourceUrl = labeledOnly(params.call.payload, "url");
    const mimeType = labeledOnly(params.call.payload, "mimeType");
    if (!nodeId) {
      return JSON.stringify({ error: "缺少 nodeId" });
    }
    if (!sourceUrl) {
      return JSON.stringify({ error: "缺少 url" });
    }
    if (!handlers?.stageMedia) {
      return JSON.stringify({ error: "无法挂上媒体" });
    }
    return JSON.stringify(
      await handlers.stageMedia(nodeId, sourceUrl, mimeType)
    );
  }
  if (params.call.name === CANVAS_RESOLVE_RESOURCE_TOOL) {
    const resourceId = params.call.resourceId.trim();
    if (!resourceId) {
      return JSON.stringify({ error: "缺少 resourceId" });
    }
    if (!params.organizationId) {
      return JSON.stringify({ error: "无法向服务端要地址" });
    }
    const resolved = await resolveResourceIdsOnServer({
      organizationId: params.organizationId,
      resourceIds: [resourceId],
    });
    const match = resolved.resolved.find(
      (entry) => entry.resourceId === resourceId
    );
    if (!match?.url) {
      return JSON.stringify({
        error: "资源无法解析",
        resourceId,
        unresolved: resolved.unresolved,
      });
    }
    return JSON.stringify({
      resourceId: match.resourceId,
      url: match.url,
      mimeType: match.mimeType,
    });
  }
  return JSON.stringify({ error: `未知工具：${params.call.name || "(空)"}` });
}

function resourceIdFromUnknown(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = resourceIdFromUnknown(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  if (!isWorkflowMediaValue(value)) {
    return undefined;
  }
  return getResourceIdFromValue(value) ?? undefined;
}
