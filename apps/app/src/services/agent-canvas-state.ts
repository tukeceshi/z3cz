import {
  AI_TEXT_NODE_TYPE,
  getResourceIdFromValue,
  isWorkflowMediaValue,
} from "@dafthunk/types";
import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";

import type { AgentGenerationMode } from "@/components/workflow/agent-canvas-connect";
import { parseGenerationMode } from "@/components/workflow/agent-canvas-connect";
import { readAiTextDisplayExcerptSync } from "@/components/workflow/ai-text-node-utils";
import type {
  WorkflowEdgeType,
  WorkflowNodeType,
  WorkflowParameter,
} from "@/components/workflow/workflow-types";
import {
  CANVAS_CONNECT_NODES_TOOL,
  CANVAS_CREATE_GENERATION_FLOW_TOOL,
  CANVAS_MAKE_CAPABILITY,
  isMakeTool,
  isToolAllowed,
  lookupAgentTool,
  SIMPLE_ANIMATION_CAPABILITY,
  SIMPLE_ANIMATION_TOOL,
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
export {
  CANVAS_CONNECT_NODES_TOOL,
  CANVAS_CREATE_GENERATION_FLOW_TOOL,
  CANVAS_MAKE_CAPABILITY,
};
export const REMOTION_OPEN_TOOL = "remotion_open" as const;
export const REMOTION_CLOSE_TOOL = "remotion_close" as const;
export const REMOTION_GET_TOOL = "remotion_get" as const;
export const REMOTION_WRITE_TOOL = "remotion_write" as const;
export { SIMPLE_ANIMATION_TOOL };
export const AGENT_CANVAS_EXCERPT_MAX_CHARS = 120;

export interface CanvasAgentNodeSummary {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly selected?: true;
  readonly resourceId?: string;
  readonly prompt?: string;
  readonly excerpt?: string;
  readonly empty?: true;
}

export interface AgentGenerationFlowInput {
  readonly mode: AgentGenerationMode;
  readonly prompt: string;
  readonly referenceNodeIds: readonly string[];
  readonly autoRun: boolean;
  readonly x?: number;
  readonly y?: number;
}

export interface AgentConnectInput {
  readonly fromNodeId: string;
  readonly toNodeId: string;
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
  readonly showViewport?: () => void;
  readonly hideViewport?: () => void;
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
  readonly createGenerationFlow?: (
    input: AgentGenerationFlowInput
  ) => Promise<{
    readonly ok: boolean;
    readonly nodeId?: string;
    readonly error?: string;
  }>;
  readonly connectNodes?: (
    connections: readonly AgentConnectInput[]
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

function promptFromNodeData(data: WorkflowNodeType): string | undefined {
  const value = data.inputs.find((input) => input.id === "prompt")?.value;
  if (typeof value !== "string") {
    return undefined;
  }
  return truncateAgentCanvasExcerpt(value);
}

export function compactCanvasAgentState(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[],
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[]
): CanvasAgentStateSummary {
  return {
    nodes: nodes.map((node) => {
      const nodeType = node.data.nodeType ?? node.type ?? "";
      const resourceId = firstResourceIdFromNodeData(node.data);
      const prompt = promptFromNodeData(node.data);
      const excerpt =
        nodeType === AI_TEXT_NODE_TYPE
          ? truncateAgentCanvasExcerpt(readAiTextDisplayExcerptSync(node.data))
          : undefined;
      const empty = !resourceId && !prompt && !excerpt;
      return {
        id: node.id,
        type: nodeType,
        name: node.data.name,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
        ...(node.selected ? { selected: true as const } : {}),
        ...(resourceId ? { resourceId } : {}),
        ...(prompt ? { prompt } : {}),
        ...(excerpt ? { excerpt } : {}),
        ...(empty ? { empty: true as const } : {}),
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

export function toolCallFromFunctionArgs(
  name: string,
  argsJson: string
): AgentToolCall {
  const trimmed = argsJson.trim();
  if (!trimmed) {
    return { name, resourceId: "", nodeId: "", payload: "" };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { name, resourceId: "", nodeId: "", payload: trimmed };
    }
    const record = parsed as Record<string, unknown>;
    const resourceId =
      typeof record.resourceId === "string" ? record.resourceId : "";
    const nodeId = typeof record.nodeId === "string" ? record.nodeId : "";
    if (
      name === SIMPLE_ANIMATION_TOOL ||
      name === CANVAS_CREATE_GENERATION_FLOW_TOOL ||
      name === CANVAS_CONNECT_NODES_TOOL
    ) {
      return { name, resourceId, nodeId, payload: trimmed };
    }
    if (typeof record.source === "string") {
      return { name, resourceId, nodeId, payload: record.source };
    }
    if (typeof record.text === "string") {
      return { name, resourceId, nodeId, payload: record.text };
    }
    return { name, resourceId, nodeId, payload: trimmed };
  } catch {
    return parseAgentToolCall(`${name}\n${trimmed}`);
  }
}

export function parseAgentToolCall(body: string): AgentToolCall {
  const normalized = body
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

function readJsonRecord(payload: string): Record<string, unknown> | undefined {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function stringListFromUnknown(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseGenerationFlowInput(
  payload: string
): AgentGenerationFlowInput | { readonly error: string } {
  const record = readJsonRecord(payload);
  if (!record) {
    return { error: "缺少参数" };
  }
  const mode = parseGenerationMode(record.mode);
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  if (!mode) {
    return { error: "缺少 mode" };
  }
  if (!prompt) {
    return { error: "缺少 prompt" };
  }
  const x = typeof record.x === "number" ? record.x : undefined;
  const y = typeof record.y === "number" ? record.y : undefined;
  return {
    mode,
    prompt,
    referenceNodeIds: stringListFromUnknown(record.referenceNodeIds),
    autoRun: record.autoRun === false ? false : true,
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
  };
}

function parseConnectInputs(
  payload: string
): readonly AgentConnectInput[] | { readonly error: string } {
  const record = readJsonRecord(payload);
  if (!record) {
    return { error: "缺少参数" };
  }
  if (!Array.isArray(record.connections)) {
    return { error: "缺少 connections" };
  }
  const connections: AgentConnectInput[] = [];
  for (const item of record.connections) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const row = item as { readonly fromNodeId?: unknown; readonly toNodeId?: unknown };
    const fromNodeId =
      typeof row.fromNodeId === "string" ? row.fromNodeId.trim() : "";
    const toNodeId = typeof row.toNodeId === "string" ? row.toNodeId.trim() : "";
    if (!fromNodeId || !toNodeId) {
      continue;
    }
    connections.push({ fromNodeId, toNodeId });
  }
  if (connections.length === 0) {
    return { error: "缺少 connections" };
  }
  return connections;
}

function writeTextFromCall(call: AgentToolCall): string {
  const record = readJsonRecord(call.payload);
  if (typeof record?.text === "string") {
    return record.text;
  }
  return restAfterFirstLine(call.payload).trim() || call.payload.trim();
}

function stageUrlFromCall(call: AgentToolCall): {
  readonly url: string;
  readonly mimeType: string;
} {
  const record = readJsonRecord(call.payload);
  const url =
    typeof record?.url === "string" ? record.url.trim() : labeledOnly(call.payload, "url");
  const mimeType =
    typeof record?.mimeType === "string"
      ? record.mimeType.trim()
      : labeledOnly(call.payload, "mimeType");
  return { url, mimeType };
}

type SimpleAnimationAction = "get" | "write" | "open" | "close" | "clear";

export const EMPTY_SIMPLE_ANIMATION_SOURCE = `function Scene() {
  return <AbsoluteFill style={{ background: "#000" }} />;
}

function RemotionRoot() {
  return (
    <Composition
      id="Main"
      component={Scene}
      durationInFrames={90}
      fps={30}
      width={1280}
      height={720}
    />
  );
}`;

function actionFromLegacyRemotionName(name: string): SimpleAnimationAction | undefined {
  if (name === REMOTION_GET_TOOL) {
    return "get";
  }
  if (name === REMOTION_WRITE_TOOL) {
    return "write";
  }
  if (name === REMOTION_OPEN_TOOL) {
    return "open";
  }
  if (name === REMOTION_CLOSE_TOOL) {
    return "close";
  }
  return undefined;
}

function simpleAnimationCall(call: AgentToolCall): {
  readonly action: SimpleAnimationAction;
  readonly source: string;
} | undefined {
  const legacy = actionFromLegacyRemotionName(call.name);
  if (legacy) {
    return { action: legacy, source: call.payload };
  }
  if (call.name !== SIMPLE_ANIMATION_TOOL) {
    return undefined;
  }
  const trimmed = call.payload.trim();
  if (!trimmed) {
    return { action: "get", source: "" };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { action: "get", source: "" };
    }
    const record = parsed as {
      readonly action?: unknown;
      readonly source?: unknown;
    };
    const action =
      record.action === "get" ||
      record.action === "write" ||
      record.action === "open" ||
      record.action === "close" ||
      record.action === "clear"
        ? record.action
        : undefined;
    if (!action) {
      return undefined;
    }
    return {
      action,
      source: typeof record.source === "string" ? record.source : "",
    };
  } catch {
    return undefined;
  }
}

async function executeSimpleAnimation(
  call: {
    readonly action: SimpleAnimationAction;
    readonly source: string;
  },
  handlers: AgentCapabilityHandlers | undefined
): Promise<string> {
  if (!handlers) {
    return JSON.stringify({ error: "无法使用简易动画" });
  }
  if (call.action === "open") {
    handlers.showViewport?.();
    return JSON.stringify({ ok: true, open: true });
  }
  if (call.action === "close") {
    handlers.hideViewport?.();
    return JSON.stringify({ ok: true, open: false });
  }
  if (call.action === "get") {
    return JSON.stringify({ sourceCode: await handlers.readSource() });
  }
  if (
    !hasCapability(handlers.consentedCapabilities, SIMPLE_ANIMATION_CAPABILITY)
  ) {
    return JSON.stringify({ pendingConfirm: true });
  }
  if (call.action === "clear") {
    const written = await handlers.writeSource(EMPTY_SIMPLE_ANIMATION_SOURCE);
    return JSON.stringify({ ...written, cleared: true });
  }
  const sourceCode = call.source.trim();
  if (!sourceCode) {
    return JSON.stringify({ error: "缺少源码" });
  }
  return JSON.stringify(await handlers.writeSource(sourceCode));
}

export function isPendingAnimationConfirm(result: string): boolean {
  try {
    const parsed = JSON.parse(result) as { pendingConfirm?: unknown };
    return parsed.pendingConfirm === true;
  } catch {
    return false;
  }
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
        error: "问答：不能改画布。",
      });
    }
    if (handlers?.sessionMode === "draft") {
      return JSON.stringify({
        error: "草案：不能打开执行能力。试用只进草稿。",
      });
    }
    return JSON.stringify({
      error: `该工具未启用：${params.call.name}`,
    });
  }

  if (params.call.name === CANVAS_GET_STATE_TOOL) {
    return JSON.stringify(params.snapshot);
  }
  const animation = simpleAnimationCall(params.call);
  if (animation) {
    return executeSimpleAnimation(animation, handlers);
  }
  if (
    isMakeTool(params.call.name) &&
    !hasCapability(handlers?.consentedCapabilities, CANVAS_MAKE_CAPABILITY)
  ) {
    return JSON.stringify({ pendingConfirm: true });
  }
  if (params.call.name === CANVAS_CREATE_GENERATION_FLOW_TOOL) {
    const input = parseGenerationFlowInput(params.call.payload);
    if ("error" in input) {
      return JSON.stringify({ error: input.error });
    }
    if (!handlers?.createGenerationFlow) {
      return JSON.stringify({ error: "无法创建节点" });
    }
    return JSON.stringify(await handlers.createGenerationFlow(input));
  }
  if (params.call.name === CANVAS_CONNECT_NODES_TOOL) {
    const connections = parseConnectInputs(params.call.payload);
    if ("error" in connections) {
      return JSON.stringify({ error: connections.error });
    }
    if (!handlers?.connectNodes) {
      return JSON.stringify({ error: "无法连线" });
    }
    return JSON.stringify(await handlers.connectNodes(connections));
  }
  if (params.call.name === CANVAS_WRITE_TEXT_TOOL) {
    const record = readJsonRecord(params.call.payload);
    const nodeId =
      params.call.nodeId.trim() ||
      (typeof record?.nodeId === "string" ? record.nodeId.trim() : "");
    const text = writeTextFromCall(params.call);
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
    const record = readJsonRecord(params.call.payload);
    const nodeId =
      params.call.nodeId.trim() ||
      (typeof record?.nodeId === "string" ? record.nodeId.trim() : "");
    if (!nodeId) {
      return JSON.stringify({ error: "缺少 nodeId" });
    }
    if (!handlers?.runNode) {
      return JSON.stringify({ error: "无法运行该节点" });
    }
    return JSON.stringify(await handlers.runNode(nodeId));
  }
  if (params.call.name === CANVAS_STAGE_MEDIA_TOOL) {
    const record = readJsonRecord(params.call.payload);
    const nodeId =
      params.call.nodeId.trim() ||
      (typeof record?.nodeId === "string" ? record.nodeId.trim() : "");
    const { url: sourceUrl, mimeType } = stageUrlFromCall(params.call);
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
