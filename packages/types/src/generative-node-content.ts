import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "./ai-interface";
import {
  hasGeneratingResource,
  isResourceIdReference,
  type ResourceIdReference,
  type WorkflowMediaValue,
} from "./media-reference";
import type { MediaResourceKind } from "./media-resource-catalog";
import type {
  AiAudioResultHistory,
  AiAudioResultHistoryItem,
  AiImageResultHistory,
  AiImageResultHistoryItem,
  AiTextResultHistory,
  AiTextResultHistoryItem,
  AiVideoResultHistory,
  AiVideoResultHistoryItem,
  WorkflowNodeContentPatch,
} from "./platform-ai-model";
import type { Node, Parameter } from "./workflow";

export const GENERATIVE_NODE_MAX_HISTORY_ITEMS = 30 as const;

export const AI_IMAGE_RESULT_INPUT = "images_result" as const;
export const AI_IMAGE_HISTORY_INPUT = "images_history" as const;
export const AI_IMAGE_OUTPUT = "images" as const;

export const AI_VIDEO_RESULT_INPUT = "videos_result" as const;
export const AI_VIDEO_HISTORY_INPUT = "videos_history" as const;
export const AI_VIDEO_OUTPUT = "videos" as const;

export const AI_AUDIO_RESULT_INPUT = "audios_result" as const;
export const AI_AUDIO_HISTORY_INPUT = "audios_history" as const;
export const AI_AUDIO_OUTPUT = "audios" as const;

export const AI_TEXT_RESULT_INPUT = "result" as const;
export const AI_TEXT_HISTORY_INPUT = "result_history" as const;

export const GENERATIVE_CONTENT_MODE_META_KEY = "generativeContentMode" as const;

export interface GenerativeHistoryAppendMeta {
  readonly prompt?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly providerModelId?: string;
  readonly modelDisplayName?: string;
}

export interface AppendImageGeneratingContentParams
  extends GenerativeHistoryAppendMeta {
  readonly resourceIds: readonly string[];
  readonly jobId?: string;
  readonly mimeType?: string;
}

export interface AppendMediaGeneratingContentParams
  extends GenerativeHistoryAppendMeta {
  readonly resourceIds: readonly string[];
  readonly jobId: string;
  readonly mimeType: string;
}

export interface AppendTextGeneratingContentParams {
  readonly invocationId: string;
  readonly resourceId: string;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly modelDisplayName?: string;
}

function upsertNodeInput(
  inputs: readonly Parameter[],
  name: string,
  value: unknown,
  type: Parameter["type"] = "json"
): Parameter[] {
  if (inputs.some((input) => input.name === name)) {
    return inputs.map((input) =>
      input.name === name ? ({ ...input, type, value } as Parameter) : input
    );
  }

  return [
    ...inputs,
    {
      name,
      type,
      hidden: true,
      value,
    } as Parameter,
  ];
}

function readJsonInput<T>(inputs: readonly Parameter[], name: string): T | null {
  const input = inputs.find((entry) => entry.name === name);
  if (!input || input.value == null) {
    return null;
  }
  return input.value as T;
}

function withGenerativeGeneratedContentMode(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata?.[GENERATIVE_CONTENT_MODE_META_KEY]) {
    return metadata;
  }
  const next = { ...metadata };
  delete next[GENERATIVE_CONTENT_MODE_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

function createHistoryItemId(batchId: number, index: number): string {
  return `gen-${batchId}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildGeneratingResourceRefs(
  resourceIds: readonly string[],
  mimeType: string
): readonly ResourceIdReference[] {
  return resourceIds.map((resourceId) => ({
    resourceId,
    mimeType,
    generating: true,
    kind: "ephemeral" as const,
  }));
}

function readImageHistory(inputs: readonly Parameter[]): AiImageResultHistory {
  const raw = readJsonInput<AiImageResultHistory>(inputs, AI_IMAGE_HISTORY_INPUT);
  if (!raw || !Array.isArray(raw.items)) {
    return { items: [], selectedId: null };
  }
  return {
    items: raw.items,
    selectedId: typeof raw.selectedId === "string" ? raw.selectedId : null,
  };
}

function readVideoHistory(inputs: readonly Parameter[]): AiVideoResultHistory {
  const raw = readJsonInput<AiVideoResultHistory>(inputs, AI_VIDEO_HISTORY_INPUT);
  if (!raw || !Array.isArray(raw.items)) {
    return { items: [], selectedId: null };
  }
  return {
    items: raw.items,
    selectedId: typeof raw.selectedId === "string" ? raw.selectedId : null,
  };
}

function readAudioHistory(inputs: readonly Parameter[]): AiAudioResultHistory {
  const raw = readJsonInput<AiAudioResultHistory>(inputs, AI_AUDIO_HISTORY_INPUT);
  if (!raw || !Array.isArray(raw.items)) {
    return { items: [], selectedId: null };
  }
  return {
    items: raw.items,
    selectedId: typeof raw.selectedId === "string" ? raw.selectedId : null,
  };
}

function readTextHistory(inputs: readonly Parameter[]): AiTextResultHistory {
  const raw = readJsonInput<AiTextResultHistory>(inputs, AI_TEXT_HISTORY_INPUT);
  if (!raw || !Array.isArray(raw.items)) {
    return { items: [], selectedId: null };
  }
  return {
    items: raw.items,
    selectedId: typeof raw.selectedId === "string" ? raw.selectedId : null,
  };
}

function syncSelectedHistoryMedia<T extends { readonly id: string }>(
  inputs: Parameter[],
  historyInputName: string,
  selectedId: string | null,
  media: readonly WorkflowMediaValue[],
  withMedia: (item: T, media: readonly WorkflowMediaValue[]) => T
): Parameter[] {
  if (!selectedId) {
    return inputs;
  }
  const history = readJsonInput<{ items: T[]; selectedId: string | null }>(
    inputs,
    historyInputName
  );
  if (!history?.items) {
    return inputs;
  }
  const nextHistory = {
    selectedId,
    items: history.items.map((item) =>
      item.id === selectedId ? withMedia(item, media) : item
    ),
  };
  return upsertNodeInput(inputs, historyInputName, nextHistory, "json");
}

function applyMediaResultToNode(
  node: Node,
  params: {
    readonly resultInputName: string;
    readonly historyInputName: string;
    readonly outputName: string;
    readonly media: readonly WorkflowMediaValue[];
    readonly clearManualInput?: string;
  }
): Pick<Node, "inputs" | "outputs"> {
  let inputs = upsertNodeInput(
    node.inputs,
    params.resultInputName,
    [...params.media],
    "json"
  );
  if (params.clearManualInput) {
    inputs = upsertNodeInput(inputs, params.clearManualInput, [], "json");
  }

  const historyRaw = readJsonInput<{ selectedId: string | null }>(
    inputs,
    params.historyInputName
  );
  if (historyRaw?.selectedId) {
    inputs = syncSelectedHistoryMedia(
      inputs,
      params.historyInputName,
      historyRaw.selectedId,
      params.media,
      (item, nextMedia) => {
        if ("images" in item) {
          return { ...item, images: [...nextMedia] };
        }
        if ("videos" in item) {
          return { ...(item as AiVideoResultHistoryItem), videos: [...nextMedia] };
        }
        return { ...(item as AiAudioResultHistoryItem), audios: [...nextMedia] };
      }
    );
  }

  const outputs = node.outputs.map((output) =>
    output.name === params.outputName
      ? ({ ...output, value: [...params.media] } as Parameter)
      : output
  );

  return { inputs, outputs };
}

function applyKindToMedia(
  media: WorkflowMediaValue,
  kindsById: ReadonlyMap<string, MediaResourceKind>
): WorkflowMediaValue {
  if (!isResourceIdReference(media)) {
    return media;
  }
  const kind = kindsById.get(media.resourceId);
  if (!kind || media.kind === kind) {
    return media;
  }
  return { ...media, kind };
}

function applyKindToMediaList(
  media: readonly WorkflowMediaValue[],
  kindsById: ReadonlyMap<string, MediaResourceKind>
): readonly WorkflowMediaValue[] {
  return media.map((entry) => applyKindToMedia(entry, kindsById));
}

function mediaKindListChanged(
  previous: readonly WorkflowMediaValue[],
  next: readonly WorkflowMediaValue[]
): boolean {
  if (previous.length !== next.length) {
    return true;
  }
  return previous.some((entry, index) => entry !== next[index]);
}

/** Write catalog `kind` onto matching media refs in workflow node JSON. */
export function patchNodeMediaResourceKinds(
  node: Node,
  kindsById: ReadonlyMap<string, MediaResourceKind>
): Partial<Node> | null {
  if (kindsById.size === 0) {
    return null;
  }

  if (node.type === AI_IMAGE_NODE_TYPE) {
    const history = readImageHistory(node.inputs);
    const nextItems = history.items.map((item) => ({
      ...item,
      images: applyKindToMediaList(item.images, kindsById),
    }));
    const result = readJsonInput<WorkflowMediaValue[]>(
      node.inputs,
      AI_IMAGE_RESULT_INPUT
    );
    const nextResult = Array.isArray(result)
      ? applyKindToMediaList(result, kindsById)
      : result;
    const historyChanged = nextItems.some(
      (item, index) =>
        mediaKindListChanged(history.items[index]!.images, item.images)
    );
    const resultChanged =
      Array.isArray(result) &&
      Array.isArray(nextResult) &&
      mediaKindListChanged(result, nextResult);
    if (!historyChanged && !resultChanged) {
      return null;
    }
    let inputs = upsertNodeInput(
      node.inputs,
      AI_IMAGE_HISTORY_INPUT,
      { ...history, items: nextItems },
      "json"
    );
    if (resultChanged && nextResult) {
      inputs = upsertNodeInput(inputs, AI_IMAGE_RESULT_INPUT, [...nextResult], "json");
    }
    const outputs = node.outputs.map((output) =>
      output.name === AI_IMAGE_OUTPUT && Array.isArray(nextResult)
        ? ({ ...output, value: [...nextResult] } as Parameter)
        : output
    );
    return { inputs, outputs };
  }

  if (node.type === AI_VIDEO_NODE_TYPE) {
    const history = readVideoHistory(node.inputs);
    const nextItems = history.items.map((item) => ({
      ...item,
      videos: applyKindToMediaList(item.videos, kindsById),
    }));
    const result = readJsonInput<WorkflowMediaValue[]>(
      node.inputs,
      AI_VIDEO_RESULT_INPUT
    );
    const nextResult = Array.isArray(result)
      ? applyKindToMediaList(result, kindsById)
      : result;
    const historyChanged = nextItems.some(
      (item, index) =>
        mediaKindListChanged(history.items[index]!.videos, item.videos)
    );
    const resultChanged =
      Array.isArray(result) &&
      Array.isArray(nextResult) &&
      mediaKindListChanged(result, nextResult);
    if (!historyChanged && !resultChanged) {
      return null;
    }
    let inputs = upsertNodeInput(
      node.inputs,
      AI_VIDEO_HISTORY_INPUT,
      { ...history, items: nextItems },
      "json"
    );
    if (resultChanged && nextResult) {
      inputs = upsertNodeInput(inputs, AI_VIDEO_RESULT_INPUT, [...nextResult], "json");
    }
    const outputs = node.outputs.map((output) =>
      output.name === AI_VIDEO_OUTPUT && Array.isArray(nextResult)
        ? ({ ...output, value: [...nextResult] } as Parameter)
        : output
    );
    return { inputs, outputs };
  }

  if (node.type === AI_AUDIO_NODE_TYPE) {
    const history = readAudioHistory(node.inputs);
    const nextItems = history.items.map((item) => ({
      ...item,
      audios: applyKindToMediaList(item.audios, kindsById),
    }));
    const result = readJsonInput<WorkflowMediaValue[]>(
      node.inputs,
      AI_AUDIO_RESULT_INPUT
    );
    const nextResult = Array.isArray(result)
      ? applyKindToMediaList(result, kindsById)
      : result;
    const historyChanged = nextItems.some(
      (item, index) =>
        mediaKindListChanged(history.items[index]!.audios, item.audios)
    );
    const resultChanged =
      Array.isArray(result) &&
      Array.isArray(nextResult) &&
      mediaKindListChanged(result, nextResult);
    if (!historyChanged && !resultChanged) {
      return null;
    }
    let inputs = upsertNodeInput(
      node.inputs,
      AI_AUDIO_HISTORY_INPUT,
      { ...history, items: nextItems },
      "json"
    );
    if (resultChanged && nextResult) {
      inputs = upsertNodeInput(inputs, AI_AUDIO_RESULT_INPUT, [...nextResult], "json");
    }
    const outputs = node.outputs.map((output) =>
      output.name === AI_AUDIO_OUTPUT && Array.isArray(nextResult)
        ? ({ ...output, value: [...nextResult] } as Parameter)
        : output
    );
    return { inputs, outputs };
  }

  if (node.type === AI_TEXT_NODE_TYPE) {
    const result = readJsonInput<ResourceIdReference>(
      node.inputs,
      AI_TEXT_RESULT_INPUT
    );
    if (!result || !isResourceIdReference(result)) {
      return null;
    }
    const nextResult = applyKindToMedia(result, kindsById);
    if (nextResult === result) {
      return null;
    }
    const inputs = upsertNodeInput(
      node.inputs,
      AI_TEXT_RESULT_INPUT,
      nextResult,
      "json"
    );
    return { inputs };
  }

  return null;
}

function historyContainsGeneratingResourceIds(
  items: readonly { readonly images?: readonly WorkflowMediaValue[]; readonly videos?: readonly WorkflowMediaValue[]; readonly audios?: readonly WorkflowMediaValue[] }[],
  resourceIds: readonly string[]
): boolean {
  if (resourceIds.length === 0) {
    return false;
  }
  const ids = new Set(resourceIds);
  return items.some((item) => {
    const media = item.images ?? item.videos ?? item.audios ?? [];
    return media.some(
      (entry) =>
        isResourceIdReference(entry) &&
        entry.generating &&
        ids.has(entry.resourceId)
    );
  });
}

function historyContainsJobId(
  items: readonly { readonly jobId?: string }[],
  jobId: string | undefined
): boolean {
  if (!jobId) {
    return false;
  }
  return items.some((item) => item.jobId === jobId);
}

export function appendImageGeneratingContent(
  node: Node,
  params: AppendImageGeneratingContentParams
): Partial<Node> | null {
  if (node.type !== AI_IMAGE_NODE_TYPE || params.resourceIds.length === 0) {
    return null;
  }

  const history = readImageHistory(node.inputs);
  if (
    historyContainsJobId(history.items, params.jobId) ||
    historyContainsGeneratingResourceIds(history.items, params.resourceIds)
  ) {
    return null;
  }

  const mimeType = params.mimeType ?? "image/png";
  const createdAt = new Date().toISOString();
  const batchId = Date.now();

  const newItems: AiImageResultHistoryItem[] = params.resourceIds.map(
    (resourceId, index) => ({
      id: createHistoryItemId(batchId, index),
      images: [
        {
          resourceId,
          mimeType,
          generating: true,
          kind: "ephemeral" as const,
        },
      ],
      prompt: params.prompt ?? "",
      params: params.params,
      platformModelId: params.platformModelId,
      aiInterfaceId: params.aiInterfaceId,
      providerModelId: params.providerModelId,
      modelDisplayName: params.modelDisplayName,
      createdAt,
      ...(params.jobId ? { jobId: params.jobId } : {}),
    })
  );
  const primary = newItems[0]!;
  const nextHistory: AiImageResultHistory = {
    items: [...newItems, ...history.items].slice(
      0,
      GENERATIVE_NODE_MAX_HISTORY_ITEMS
    ),
    selectedId: primary.id,
  };

  let inputs = upsertNodeInput(node.inputs, AI_IMAGE_HISTORY_INPUT, nextHistory, "json");
  inputs = upsertNodeInput(inputs, "manual_images", [], "json");

  const mediaResult = applyMediaResultToNode(
    { ...node, inputs },
    {
      resultInputName: AI_IMAGE_RESULT_INPUT,
      historyInputName: AI_IMAGE_HISTORY_INPUT,
      outputName: AI_IMAGE_OUTPUT,
      media: primary.images,
      clearManualInput: "manual_images",
    }
  );

  return {
    ...mediaResult,
    metadata: withGenerativeGeneratedContentMode(node.metadata),
  };
}

export function appendVideoGeneratingContent(
  node: Node,
  params: AppendMediaGeneratingContentParams
): Partial<Node> | null {
  if (node.type !== AI_VIDEO_NODE_TYPE || params.resourceIds.length === 0) {
    return null;
  }

  const history = readVideoHistory(node.inputs);
  if (
    historyContainsJobId(history.items, params.jobId) ||
    historyContainsGeneratingResourceIds(history.items, params.resourceIds)
  ) {
    return null;
  }

  const generatingRefs = buildGeneratingResourceRefs(
    params.resourceIds,
    params.mimeType
  );
  const item: AiVideoResultHistoryItem = {
    id: createHistoryItemId(Date.now(), 0),
    videos: [...generatingRefs],
    prompt: params.prompt ?? "",
    params: params.params,
    platformModelId: params.platformModelId,
    aiInterfaceId: params.aiInterfaceId,
    providerModelId: params.providerModelId,
    modelDisplayName: params.modelDisplayName,
    createdAt: new Date().toISOString(),
    jobId: params.jobId,
  };
  const nextHistory: AiVideoResultHistory = {
    items: [item, ...history.items].slice(0, GENERATIVE_NODE_MAX_HISTORY_ITEMS),
    selectedId: item.id,
  };

  let inputs = upsertNodeInput(node.inputs, AI_VIDEO_HISTORY_INPUT, nextHistory, "json");
  inputs = upsertNodeInput(inputs, "manual_videos", [], "json");

  const mediaResult = applyMediaResultToNode(
    { ...node, inputs },
    {
      resultInputName: AI_VIDEO_RESULT_INPUT,
      historyInputName: AI_VIDEO_HISTORY_INPUT,
      outputName: AI_VIDEO_OUTPUT,
      media: generatingRefs,
      clearManualInput: "manual_videos",
    }
  );

  return {
    ...mediaResult,
    metadata: withGenerativeGeneratedContentMode(node.metadata),
  };
}

export function appendAudioGeneratingContent(
  node: Node,
  params: AppendMediaGeneratingContentParams
): Partial<Node> | null {
  if (node.type !== AI_AUDIO_NODE_TYPE || params.resourceIds.length === 0) {
    return null;
  }

  const history = readAudioHistory(node.inputs);
  if (
    historyContainsJobId(history.items, params.jobId) ||
    historyContainsGeneratingResourceIds(history.items, params.resourceIds)
  ) {
    return null;
  }

  const generatingRefs = buildGeneratingResourceRefs(
    params.resourceIds,
    params.mimeType
  );
  const item: AiAudioResultHistoryItem = {
    id: createHistoryItemId(Date.now(), 0),
    audios: [...generatingRefs],
    prompt: params.prompt ?? "",
    params: params.params,
    platformModelId: params.platformModelId,
    aiInterfaceId: params.aiInterfaceId,
    providerModelId: params.providerModelId,
    modelDisplayName: params.modelDisplayName,
    createdAt: new Date().toISOString(),
    jobId: params.jobId,
  };
  const nextHistory: AiAudioResultHistory = {
    items: [item, ...history.items].slice(0, GENERATIVE_NODE_MAX_HISTORY_ITEMS),
    selectedId: item.id,
  };

  let inputs = upsertNodeInput(node.inputs, AI_AUDIO_HISTORY_INPUT, nextHistory, "json");
  inputs = upsertNodeInput(inputs, "manual_audios", [], "json");

  const mediaResult = applyMediaResultToNode(
    { ...node, inputs },
    {
      resultInputName: AI_AUDIO_RESULT_INPUT,
      historyInputName: AI_AUDIO_HISTORY_INPUT,
      outputName: AI_AUDIO_OUTPUT,
      media: generatingRefs,
      clearManualInput: "manual_audios",
    }
  );

  return {
    ...mediaResult,
    metadata: withGenerativeGeneratedContentMode(node.metadata),
  };
}

export function appendTextGeneratingContent(
  node: Node,
  params: AppendTextGeneratingContentParams
): Partial<Node> | null {
  if (node.type !== AI_TEXT_NODE_TYPE) {
    return null;
  }

  const history = readTextHistory(node.inputs);
  if (history.items.some((item) => item.invocationId === params.invocationId)) {
    return null;
  }

  const generatingRef: ResourceIdReference = {
    resourceId: params.resourceId,
    mimeType: "text/plain",
    generating: true,
    kind: "ephemeral",
  };
  const item: AiTextResultHistoryItem = {
    id: createHistoryItemId(Date.now(), 0),
    resourceId: params.resourceId,
    platformModelId: params.platformModelId,
    aiInterfaceId: params.aiInterfaceId,
    modelDisplayName: params.modelDisplayName,
    createdAt: new Date().toISOString(),
    invocationId: params.invocationId,
  };
  const nextHistory: AiTextResultHistory = {
    items: [item, ...history.items].slice(0, GENERATIVE_NODE_MAX_HISTORY_ITEMS),
    selectedId: item.id,
  };

  let inputs = upsertNodeInput(
    node.inputs,
    AI_TEXT_HISTORY_INPUT,
    nextHistory,
    "json"
  );
  inputs = upsertNodeInput(inputs, AI_TEXT_RESULT_INPUT, generatingRef, "json");

  return { inputs };
}

export function buildWorkflowNodeContentPatch(
  previous: Node,
  next: Node
): WorkflowNodeContentPatch | null {
  const inputNames = new Set<string>();
  for (const input of [...previous.inputs, ...next.inputs]) {
    inputNames.add(input.name);
  }

  const inputs: Record<string, unknown> = {};
  let inputsChanged = false;
  for (const name of inputNames) {
    const prevValue = previous.inputs.find((input) => input.name === name)?.value;
    const nextValue = next.inputs.find((input) => input.name === name)?.value;
    if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      inputs[name] = nextValue;
      inputsChanged = true;
    }
  }

  const outputNames = new Set<string>();
  for (const output of [...previous.outputs, ...next.outputs]) {
    outputNames.add(output.name);
  }

  const outputs: Record<string, unknown> = {};
  let outputsChanged = false;
  for (const name of outputNames) {
    const prevValue = previous.outputs.find((output) => output.name === name)?.value;
    const nextValue = next.outputs.find((output) => output.name === name)?.value;
    if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      outputs[name] = nextValue;
      outputsChanged = true;
    }
  }

  const metadataChanged =
    JSON.stringify(previous.metadata ?? null) !==
    JSON.stringify(next.metadata ?? null);

  if (!inputsChanged && !outputsChanged && !metadataChanged) {
    return null;
  }

  return {
    ...(inputsChanged ? { inputs } : {}),
    ...(outputsChanged ? { outputs } : {}),
    ...(metadataChanged && next.metadata ? { metadata: next.metadata } : {}),
  };
}

function collectInFlightHistoryItemIds(node: Node): readonly string[] {
  switch (node.type) {
    case AI_IMAGE_NODE_TYPE: {
      return readImageHistory(node.inputs).items
        .filter((item) => hasGeneratingResource(item.images))
        .map((item) => item.id);
    }
    case AI_VIDEO_NODE_TYPE: {
      return readVideoHistory(node.inputs).items
        .filter((item) => hasGeneratingResource(item.videos))
        .map((item) => item.id);
    }
    case AI_AUDIO_NODE_TYPE: {
      return readAudioHistory(node.inputs).items
        .filter((item) => hasGeneratingResource(item.audios))
        .map((item) => item.id);
    }
    case AI_TEXT_NODE_TYPE: {
      return readTextHistory(node.inputs).items
        .filter((item) => !item.text && !item.contentSha256)
        .map((item) => item.id);
    }
    default:
      return [];
  }
}

function mergeHistoryItems<T extends { readonly id: string }>(
  persistedItems: readonly T[],
  incomingItems: readonly T[]
): readonly T[] {
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  const restored = persistedItems.filter((item) => !incomingIds.has(item.id));
  if (restored.length === 0) {
    return incomingItems;
  }
  const merged = [...restored, ...incomingItems];
  return merged.slice(0, GENERATIVE_NODE_MAX_HISTORY_ITEMS);
}

function mergeInFlightMediaNode(params: {
  readonly persisted: Node;
  readonly incoming: Node;
  readonly inFlightIds: ReadonlySet<string>;
  readonly historyInput: string;
  readonly resultInput: string;
  readonly outputName: string;
  readonly readHistory: (
    inputs: readonly Parameter[]
  ) => {
    readonly items: readonly { readonly id: string }[];
    readonly selectedId: string | null;
  };
}): Node {
  const persistedHistory = params.readHistory(params.persisted.inputs);
  const incomingHistory = params.readHistory(params.incoming.inputs);
  const missing = persistedHistory.items.filter((item) =>
    params.inFlightIds.has(item.id)
  );
  if (missing.length === 0) {
    return params.incoming;
  }

  const selectedId =
    persistedHistory.selectedId &&
    params.inFlightIds.has(persistedHistory.selectedId)
      ? persistedHistory.selectedId
      : (incomingHistory.selectedId ?? persistedHistory.selectedId);

  const mergedItems = mergeHistoryItems(
    missing,
    incomingHistory.items
  );
  let inputs = upsertNodeInput(
    params.incoming.inputs,
    params.historyInput,
    {
      items: mergedItems,
      selectedId,
    },
    "json"
  );

  let outputs = params.incoming.outputs;
  if (
    persistedHistory.selectedId &&
    params.inFlightIds.has(persistedHistory.selectedId)
  ) {
    const persistedResult = readJsonInput<unknown>(
      params.persisted.inputs,
      params.resultInput
    );
    if (persistedResult !== null) {
      inputs = upsertNodeInput(
        inputs,
        params.resultInput,
        persistedResult,
        "json"
      );
    }
    const persistedOutput = params.persisted.outputs.find(
      (output) => output.name === params.outputName
    );
    if (persistedOutput && persistedOutput.value !== undefined) {
      outputs = params.incoming.outputs.map((output) =>
        output.name === params.outputName
          ? ({ ...output, value: persistedOutput.value } as Parameter)
          : output
      );
    }
  }

  return { ...params.incoming, inputs, outputs };
}

export function mergeGenerativeNodeContentOnSave(
  persisted: Node,
  incoming: Node
): Node {
  if (persisted.type !== incoming.type) {
    return incoming;
  }

  const inFlightIds = new Set(collectInFlightHistoryItemIds(persisted));
  if (inFlightIds.size === 0) {
    return incoming;
  }

  switch (incoming.type) {
    case AI_IMAGE_NODE_TYPE: {
      return mergeInFlightMediaNode({
        persisted,
        incoming,
        inFlightIds,
        historyInput: AI_IMAGE_HISTORY_INPUT,
        resultInput: AI_IMAGE_RESULT_INPUT,
        outputName: AI_IMAGE_OUTPUT,
        readHistory: readImageHistory,
      });
    }
    case AI_VIDEO_NODE_TYPE: {
      return mergeInFlightMediaNode({
        persisted,
        incoming,
        inFlightIds,
        historyInput: AI_VIDEO_HISTORY_INPUT,
        resultInput: AI_VIDEO_RESULT_INPUT,
        outputName: AI_VIDEO_OUTPUT,
        readHistory: readVideoHistory,
      });
    }
    case AI_AUDIO_NODE_TYPE: {
      return mergeInFlightMediaNode({
        persisted,
        incoming,
        inFlightIds,
        historyInput: AI_AUDIO_HISTORY_INPUT,
        resultInput: AI_AUDIO_RESULT_INPUT,
        outputName: AI_AUDIO_OUTPUT,
        readHistory: readAudioHistory,
      });
    }
    case AI_TEXT_NODE_TYPE: {
      const persistedHistory = readTextHistory(persisted.inputs);
      const incomingHistory = readTextHistory(incoming.inputs);
      const missing = persistedHistory.items.filter((item) =>
        inFlightIds.has(item.id)
      );
      if (missing.length === 0) {
        return incoming;
      }
      const mergedItems = mergeHistoryItems(
        missing,
        incomingHistory.items
      ) as AiTextResultHistoryItem[];
      let inputs = upsertNodeInput(
        incoming.inputs,
        AI_TEXT_HISTORY_INPUT,
        {
          items: mergedItems,
          selectedId: incomingHistory.selectedId ?? persistedHistory.selectedId,
        },
        "json"
      );
      const persistedResult = readJsonInput<ResourceIdReference>(
        persisted.inputs,
        AI_TEXT_RESULT_INPUT
      );
      if (persistedResult && isResourceIdReference(persistedResult) && persistedResult.generating) {
        inputs = upsertNodeInput(
          inputs,
          AI_TEXT_RESULT_INPUT,
          persistedResult,
          "json"
        );
      }
      return { ...incoming, inputs };
    }
    default:
      return incoming;
  }
}
