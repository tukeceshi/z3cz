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
  CANVAS_IMPORT_TOOL,
  CANVAS_MAKE_CAPABILITY,
  CANVAS_WRITE_NODES_TOOL,
  isMakeTool,
  isToolAllowed,
  lookupAgentTool,
  READ_URL_TOOL,
  SIMPLE_ANIMATION_CAPABILITY,
  SIMPLE_ANIMATION_TOOL,
} from "@/services/agent-capabilities";
import {
  adaptCanvasImportDocument,
  parseCanvasImportInput,
} from "@/services/agent-canvas-import";
import type { AgentCanvasImportPlan } from "@/services/agent-canvas-import";
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
  CANVAS_IMPORT_TOOL,
  CANVAS_MAKE_CAPABILITY,
  CANVAS_WRITE_NODES_TOOL,
};
export const REMOTION_OPEN_TOOL = "remotion_open" as const;
export const REMOTION_CLOSE_TOOL = "remotion_close" as const;
export const REMOTION_GET_TOOL = "remotion_get" as const;
export const REMOTION_WRITE_TOOL = "remotion_write" as const;
export { READ_URL_TOOL, SIMPLE_ANIMATION_TOOL };
export const AGENT_CANVAS_EXCERPT_MAX_CHARS = 120;
export const CANVAS_IMPORT_NOT_SUPPORTED =
  "不能导入或恢复外部画布。这个工具只新建一条生成，prompt 必须是要生成的内容。导入用 canvas_import。";
export const CANVAS_IMPORT_NEEDS_MODE =
  "画布已有节点。先问用户追加还是替换，再带 mode。";

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

export interface AgentWriteNodeInput {
  readonly id: string;
  readonly mode: AgentGenerationMode;
  readonly prompt: string;
  readonly url: string;
  readonly mimeType: string;
  readonly x?: number;
  readonly y?: number;
}

export interface AgentWriteNodesInput {
  readonly nodes: readonly AgentWriteNodeInput[];
  readonly connections: readonly AgentConnectInput[];
}

export interface AgentWriteNodesCreated {
  readonly id: string;
  readonly nodeId: string;
  readonly mode: AgentGenerationMode;
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
  readonly writeNodes?: (
    input: AgentWriteNodesInput
  ) => Promise<{
    readonly ok: boolean;
    readonly nodes?: readonly AgentWriteNodesCreated[];
    readonly connected?: number;
    readonly error?: string;
  }>;
  readonly fetchImportSource?: (
    url: string
  ) => Promise<
    | { readonly ok: true; readonly document: unknown }
    | { readonly ok: false; readonly error: string }
  >;
  readonly readUrl?: (
    url: string
  ) => Promise<
    | { readonly ok: true; readonly text: string }
    | { readonly ok: false; readonly error: string }
  >;
  readonly applyImport?: (
    input: AgentApplyImportInput
  ) => Promise<AgentApplyImportResult>;
}

export interface AgentApplyImportInput {
  readonly replace: boolean;
  readonly plan: AgentCanvasImportPlan;
}

export interface AgentApplyImportResult {
  readonly ok: boolean;
  readonly title?: string;
  readonly nodes?: readonly AgentWriteNodesCreated[];
  readonly connected?: number;
  readonly skipped?: readonly string[];
  readonly error?: string;
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

export function generationPromptIsCanvasImport(prompt: string): boolean {
  const text = prompt.trim();
  if (!/导入|恢复/.test(text)) {
    return false;
  }
  if (!/画布|canvas/i.test(text)) {
    return false;
  }
  return /https?:\/\//i.test(text) || /全部节点|连接关系|公开画布/.test(text);
}

export function attachMakeToolInventory(
  toolName: string,
  result: string,
  inventory: string | undefined
): string {
  if (!isMakeTool(toolName) || !inventory) {
    return result;
  }
  try {
    const parsed: unknown = JSON.parse(result);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as { readonly pendingConfirm?: unknown };
      if (record.pendingConfirm === true) {
        return result;
      }
      return JSON.stringify({
        ...(parsed as Record<string, unknown>),
        canvasInventory: inventory,
      });
    }
  } catch {
    // keep raw
  }
  return `${result}\n${inventory}`;
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
      name === CANVAS_CONNECT_NODES_TOOL ||
      name === CANVAS_WRITE_NODES_TOOL ||
      name === CANVAS_IMPORT_TOOL
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
  if (generationPromptIsCanvasImport(prompt)) {
    return { error: CANVAS_IMPORT_NOT_SUPPORTED };
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
  const connections = connectPairsFromUnknown(record.connections);
  if (connections.length === 0) {
    return { error: "缺少 connections" };
  }
  return connections;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function connectPairsFromUnknown(value: unknown): readonly AgentConnectInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const connections: AgentConnectInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const row = item as {
      readonly from?: unknown;
      readonly to?: unknown;
      readonly fromNodeId?: unknown;
      readonly toNodeId?: unknown;
    };
    const fromNodeId = stringField(row.fromNodeId) || stringField(row.from);
    const toNodeId = stringField(row.toNodeId) || stringField(row.to);
    if (!fromNodeId || !toNodeId) {
      continue;
    }
    connections.push({ fromNodeId, toNodeId });
  }
  return connections;
}

export function parseWriteNodesInput(
  payload: string
): AgentWriteNodesInput | { readonly error: string } {
  const record = readJsonRecord(payload);
  if (!record) {
    return { error: "缺少参数" };
  }
  if (!Array.isArray(record.nodes) || record.nodes.length === 0) {
    return { error: "缺少 nodes" };
  }
  const nodes: AgentWriteNodeInput[] = [];
  const seen = new Set<string>();
  for (const [index, item] of record.nodes.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const row = item as {
      readonly id?: unknown;
      readonly mode?: unknown;
      readonly prompt?: unknown;
      readonly url?: unknown;
      readonly mimeType?: unknown;
      readonly x?: unknown;
      readonly y?: unknown;
    };
    const mode = parseGenerationMode(row.mode);
    if (!mode) {
      return { error: "缺少 mode" };
    }
    const id = stringField(row.id) || `n${index + 1}`;
    if (seen.has(id)) {
      return { error: "节点 id 重复" };
    }
    seen.add(id);
    const x = typeof row.x === "number" ? row.x : undefined;
    const y = typeof row.y === "number" ? row.y : undefined;
    nodes.push({
      id,
      mode,
      prompt: stringField(row.prompt),
      url: stringField(row.url),
      mimeType: stringField(row.mimeType),
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
    });
  }
  if (nodes.length === 0) {
    return { error: "缺少 nodes" };
  }
  return {
    nodes,
    connections: connectPairsFromUnknown(record.connections),
  };
}

export function mapWriteNodeConnections(
  created: readonly AgentWriteNodesCreated[],
  connections: readonly AgentConnectInput[]
): readonly AgentConnectInput[] {
  const aliases = new Map<string, string>();
  for (const node of created) {
    aliases.set(node.id, node.nodeId);
    aliases.set(node.nodeId, node.nodeId);
  }
  return connections.map((item) => ({
    fromNodeId: aliases.get(item.fromNodeId) ?? item.fromNodeId,
    toNodeId: aliases.get(item.toNodeId) ?? item.toNodeId,
  }));
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

function parseReadUrlInput(
  payload: string
): { readonly url: string } | { readonly error: string } {
  const record = readJsonRecord(payload);
  const url =
    typeof record?.url === "string" ? record.url.trim() : labeledOnly(payload, "url");
  if (!url) {
    return { error: "缺少 url" };
  }
  return { url };
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
  if (params.call.name === READ_URL_TOOL) {
    const input = parseReadUrlInput(params.call.payload);
    if ("error" in input) {
      return JSON.stringify({ error: input.error });
    }
    if (!handlers?.readUrl) {
      return JSON.stringify({ error: "无法读取链接" });
    }
    const read = await handlers.readUrl(input.url);
    if (!read.ok) {
      return JSON.stringify({ error: read.error });
    }
    return JSON.stringify({ ok: true, text: read.text });
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
    const made = await handlers.createGenerationFlow(input);
    if (!made.ok) {
      return JSON.stringify(made);
    }
    return JSON.stringify({
      ...made,
      created: {
        kind: "generation",
        mode: input.mode,
        prompt: truncateAgentCanvasExcerpt(input.prompt) ?? input.prompt,
      },
    });
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
  if (params.call.name === CANVAS_WRITE_NODES_TOOL) {
    const input = parseWriteNodesInput(params.call.payload);
    if ("error" in input) {
      return JSON.stringify({ error: input.error });
    }
    if (!handlers?.writeNodes) {
      return JSON.stringify({ error: "无法写入节点" });
    }
    const made = await handlers.writeNodes(input);
    if (!made.ok) {
      return JSON.stringify(made);
    }
    return JSON.stringify({
      ...made,
      created: {
        kind: "nodes",
        nodes: made.nodes ?? [],
        connected: made.connected ?? 0,
      },
    });
  }
  if (params.call.name === CANVAS_IMPORT_TOOL) {
    const input = parseCanvasImportInput(params.call.payload);
    if ("error" in input) {
      return JSON.stringify({ error: input.error });
    }
    if (params.snapshot.nodes.length > 0 && !input.mode) {
      return JSON.stringify({ error: CANVAS_IMPORT_NEEDS_MODE });
    }
    let document = input.document;
    if (input.url) {
      if (!handlers?.fetchImportSource) {
        return JSON.stringify({ error: "无法读取画布" });
      }
      const fetched = await handlers.fetchImportSource(input.url);
      if (!fetched.ok) {
        return JSON.stringify({ error: fetched.error });
      }
      document = fetched.document;
    }
    const plan = adaptCanvasImportDocument(document);
    if ("error" in plan) {
      return JSON.stringify({ error: plan.error });
    }
    if (!handlers?.applyImport) {
      return JSON.stringify({ error: "无法导入画布" });
    }
    const made = await handlers.applyImport({
      replace: input.mode === "replace",
      plan,
    });
    if (!made.ok) {
      return JSON.stringify(made);
    }
    return JSON.stringify({
      ...made,
      created: {
        kind: "import",
        title: made.title ?? plan.title,
        nodes: made.nodes ?? [],
        connected: made.connected ?? 0,
        skipped: made.skipped ?? plan.skipped,
      },
    });
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
