import type { AgentGenerationMode } from "@/components/workflow/agent-canvas-connect";
import { parseGenerationMode } from "@/components/workflow/agent-canvas-connect";

export interface AgentImportNodeInput {
  readonly id: string;
  readonly mode: AgentGenerationMode;
  readonly name: string;
  readonly prompt: string;
  readonly url: string;
  readonly mimeType: string;
  readonly x?: number;
  readonly y?: number;
}

export interface AgentImportConnectionInput {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly order: number;
}

export interface AgentCanvasImportPlan {
  readonly title: string;
  readonly nodes: readonly AgentImportNodeInput[];
  readonly connections: readonly AgentImportConnectionInput[];
  readonly skipped: readonly string[];
}

export type AgentCanvasImportMode = "append" | "replace";

export interface AgentCanvasImportInput {
  readonly url: string;
  readonly document: unknown;
  readonly mode?: AgentCanvasImportMode;
}

const IMAGE_MENTION_PATTERN = /@图片(\d+)/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseImportMode(value: unknown): AgentCanvasImportMode | undefined {
  if (value === "append" || value === "replace") {
    return value;
  }
  return undefined;
}

function parseJsonDocument(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

export function parseCanvasImportInput(
  payload: string
): AgentCanvasImportInput | { readonly error: string } {
  let record: Record<string, unknown> | undefined;
  const trimmed = payload.trim();
  if (trimmed) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isRecord(parsed)) {
        record = parsed;
      }
    } catch {
      record = undefined;
    }
  }
  if (!record) {
    return { error: "缺少 url 或 json" };
  }
  const url = stringField(record.url);
  const document =
    record.json === undefined ? undefined : parseJsonDocument(record.json);
  if (!url && document === undefined) {
    return { error: "缺少 url 或 json" };
  }
  if (record.json !== undefined && document === undefined) {
    return { error: "json 无效" };
  }
  const mode = parseImportMode(record.mode);
  return {
    url,
    document,
    ...(mode ? { mode } : {}),
  };
}

function modeFromKindOrType(value: string): AgentGenerationMode | undefined {
  if (value === "ai-text") {
    return "text";
  }
  if (value === "ai-image") {
    return "image";
  }
  if (value === "ai-video") {
    return "video";
  }
  if (value === "ai-audio") {
    return "audio";
  }
  return parseGenerationMode(value);
}

function mimeTypeFromUrl(url: string, mode: AgentGenerationMode): string {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) {
    return "image/png";
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (path.endsWith(".webp")) {
    return "image/webp";
  }
  if (path.endsWith(".gif")) {
    return "image/gif";
  }
  if (path.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (path.endsWith(".webm")) {
    return "video/webm";
  }
  if (path.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (path.endsWith(".wav")) {
    return "audio/wav";
  }
  if (mode === "video") {
    return "video/mp4";
  }
  if (mode === "audio") {
    return "audio/mpeg";
  }
  return "image/png";
}

function promptFromMeta(meta: Record<string, unknown> | undefined): string {
  if (!meta) {
    return "";
  }
  return stringField(meta.prompt) || stringField(meta.content);
}

function mediaUrlFromMeta(meta: Record<string, unknown> | undefined): string {
  if (!meta) {
    return "";
  }
  return stringField(meta.mediaUrl) || stringField(meta.originalMediaUrl);
}

function hasForeignModel(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) {
    return false;
  }
  const settings = meta.settings;
  if (!isRecord(settings)) {
    return false;
  }
  return stringField(settings.modelId).length > 0;
}

function unwrapDocument(document: unknown): {
  readonly title: string;
  readonly graph: unknown;
  readonly stickerCount: number;
  readonly groupCount: number;
} {
  if (!isRecord(document)) {
    return { title: "", graph: document, stickerCount: 0, groupCount: 0 };
  }
  const nested = parseJsonDocument(document.graph);
  const graph = nested === undefined ? document : nested;
  const stickerSource = isRecord(graph) ? graph.stickers : document.stickers;
  const groupSource = isRecord(graph) ? graph.groups : document.groups;
  return {
    title: stringField(document.title) || (isRecord(graph) ? stringField(graph.title) : ""),
    graph,
    stickerCount: Array.isArray(stickerSource) ? stickerSource.length : 0,
    groupCount: Array.isArray(groupSource) ? groupSource.length : 0,
  };
}

function adaptQuantvNodes(
  items: readonly unknown[]
): {
  readonly nodes: AgentImportNodeInput[];
  readonly skippedUnknown: number;
  readonly foreignModel: boolean;
} {
  const nodes: AgentImportNodeInput[] = [];
  const seen = new Set<string>();
  let skippedUnknown = 0;
  let foreignModel = false;
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      skippedUnknown += 1;
      continue;
    }
    const mode = modeFromKindOrType(stringField(item.kind) || stringField(item.type));
    if (!mode) {
      skippedUnknown += 1;
      continue;
    }
    const id = stringField(item.id) || `n${index + 1}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const meta = isRecord(item.meta) ? item.meta : undefined;
    if (hasForeignModel(meta)) {
      foreignModel = true;
    }
    const url = mediaUrlFromMeta(meta);
    const x = numberField(item.x);
    const y = numberField(item.y);
    nodes.push({
      id,
      mode,
      name: stringField(item.title) || stringField(item.name),
      prompt: promptFromMeta(meta),
      url,
      mimeType: url ? mimeTypeFromUrl(url, mode) : "",
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
    });
  }
  return { nodes, skippedUnknown, foreignModel };
}

function adaptLocalPlanNodes(
  items: readonly unknown[]
): {
  readonly nodes: AgentImportNodeInput[];
  readonly skippedUnknown: number;
} {
  const nodes: AgentImportNodeInput[] = [];
  const seen = new Set<string>();
  let skippedUnknown = 0;
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      skippedUnknown += 1;
      continue;
    }
    const mode = modeFromKindOrType(
      stringField(item.mode) || stringField(item.type) || stringField(item.kind)
    );
    if (!mode) {
      skippedUnknown += 1;
      continue;
    }
    const id = stringField(item.id) || `n${index + 1}`;
    if (seen.has(id)) {
      skippedUnknown += 1;
      continue;
    }
    seen.add(id);
    const meta = isRecord(item.meta) ? item.meta : undefined;
    const position = isRecord(item.position) ? item.position : undefined;
    const url =
      stringField(item.url) ||
      mediaUrlFromMeta(meta);
    const x = numberField(item.x) ?? numberField(position?.x);
    const y = numberField(item.y) ?? numberField(position?.y);
    const prompt =
      stringField(item.prompt) ||
      promptFromMeta(meta) ||
      promptFromNativeInputs(item.inputs);
    nodes.push({
      id,
      mode,
      name: stringField(item.name) || stringField(item.title),
      prompt,
      url,
      mimeType: stringField(item.mimeType) || (url ? mimeTypeFromUrl(url, mode) : ""),
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
    });
  }
  return { nodes, skippedUnknown };
}

function promptFromNativeInputs(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const name = stringField(item.id) || stringField(item.name);
    if (name === "prompt" && typeof item.value === "string") {
      return item.value.trim();
    }
  }
  return "";
}

function adaptConnections(
  items: readonly unknown[],
  nodeIds: ReadonlySet<string>
): AgentImportConnectionInput[] {
  const connections: AgentImportConnectionInput[] = [];
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      continue;
    }
    const fromNodeId =
      stringField(item.from) ||
      stringField(item.fromNodeId) ||
      stringField(item.source);
    const toNodeId =
      stringField(item.to) ||
      stringField(item.toNodeId) ||
      stringField(item.target);
    if (!fromNodeId || !toNodeId) {
      continue;
    }
    if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) {
      continue;
    }
    const order = numberField(item.order);
    connections.push({
      fromNodeId,
      toNodeId,
      order: order ?? index,
    });
  }
  return connections;
}

function skipMessages(params: {
  readonly stickerCount: number;
  readonly groupCount: number;
  readonly skippedUnknown: number;
  readonly foreignModel: boolean;
}): readonly string[] {
  const skipped: string[] = [];
  if (params.stickerCount > 0) {
    skipped.push(`跳过 ${params.stickerCount} 条便签`);
  }
  if (params.groupCount > 0) {
    skipped.push("跳过分组");
  }
  if (params.skippedUnknown > 0) {
    skipped.push(`跳过 ${params.skippedUnknown} 个无法识别的节点`);
  }
  if (params.foreignModel) {
    skipped.push("跳过对方模型");
  }
  return skipped;
}

function looksLikeQuantvNodes(items: readonly unknown[]): boolean {
  return items.some((item) => isRecord(item) && stringField(item.kind).length > 0);
}

export function adaptCanvasImportDocument(
  document: unknown
): AgentCanvasImportPlan | { readonly error: string } {
  const unwrapped = unwrapDocument(document);
  if (!isRecord(unwrapped.graph)) {
    return { error: "无法识别画布格式" };
  }
  const graph = unwrapped.graph;
  const rawNodes = graph.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    return { error: "没有可导入的节点" };
  }

  const adapted = looksLikeQuantvNodes(rawNodes)
    ? adaptQuantvNodes(rawNodes)
    : adaptLocalPlanNodes(rawNodes);
  const nodes = adapted.nodes;
  if (nodes.length === 0) {
    return { error: "没有可导入的节点" };
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const rawConnections = Array.isArray(graph.connections)
    ? graph.connections
    : Array.isArray(graph.edges)
      ? graph.edges
      : [];
  const connections = adaptConnections(rawConnections, nodeIds);
  return {
    title: unwrapped.title,
    nodes,
    connections,
    skipped: skipMessages({
      stickerCount: unwrapped.stickerCount,
      groupCount: unwrapped.groupCount,
      skippedUnknown: adapted.skippedUnknown,
      foreignModel: "foreignModel" in adapted ? adapted.foreignModel : false,
    }),
  };
}

export function sortImportConnections(
  connections: readonly AgentImportConnectionInput[]
): readonly AgentImportConnectionInput[] {
  return [...connections].sort((left, right) => {
    if (left.toNodeId !== right.toNodeId) {
      return left.toNodeId.localeCompare(right.toNodeId);
    }
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.fromNodeId.localeCompare(right.fromNodeId);
  });
}

export function rewritePromptImageMentions(
  prompt: string,
  imageEdgeIdsByIndex: ReadonlyMap<number, string>
): string {
  return prompt.replace(IMAGE_MENTION_PATTERN, (match, rawIndex: string) => {
    const edgeId = imageEdgeIdsByIndex.get(Number(rawIndex));
    return edgeId ? `{{ref:${edgeId}}}` : match;
  });
}

export function imageMentionIndexMap(
  edgeIds: readonly string[]
): ReadonlyMap<number, string> {
  const map = new Map<number, string>();
  edgeIds.forEach((edgeId, index) => {
    map.set(index + 1, edgeId);
  });
  return map;
}
