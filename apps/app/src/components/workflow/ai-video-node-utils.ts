import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type AiVideoResultHistory,
  type AiVideoResultHistoryItem,
  normalizeVideoModelParameterRules,
  referencesFitVideoModelReferenceLimits,
  type SubmitAiVideoMediaReferenceCounts,
  type VideoModelParameterRules,
  type OrgVideoModelOption,
  hasGeneratingResource,
  hasDisplayableWorkflowMedia,
  isResourceIdReference,
  isWorkflowMediaValue,
  mediaReferenceToWorkflowValue,
  type MediaReference,
  type MediaResourceKind,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import type { NodeType, WorkflowNodeType, WorkflowParameter } from "./workflow-types";
import {
  AI_GENERATIVE_PANEL_HEIGHT_PX,
  AI_GENERATIVE_PANEL_PROMPT_MIN_HEIGHT_PX,
  AI_GENERATIVE_PANEL_WIDTH_PX,
} from "./ai-generative-panel-utils";
import {
  isGenerativeManualContent,
  withGenerativeGeneratedContentMode,
  withGenerativeManualContentMode,
} from "./generative-card-mode-utils";
import {
  applyHistoryItemSettingsToNode,
  type GenerativeHistorySelectionResult,
} from "./apply-history-item-settings";
import {
  readGenerativeCardCoverFromHistory,
  resolveGenerativeCardPhase,
  splitHistoryMediaRows,
  type GenerativeCardCoverRead,
} from "./generative-history-utils";
import {
  isGenerativeCardBusyPhase,
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
} from "./generative-progress-utils";
import {
  mapMediaResourceKinds,
  markResourceRefFailed,
  stripGeneratingFlag,
} from "./generative-resource-ref-utils";

import {
  AI_VIDEO_EMPTY_CARD_SIZE,
} from "./media-card-size";

export const AI_VIDEO_REFERENCE_HANDLE_ID = "reference_images" as const;
export const AI_VIDEO_PROMPT_HANDLE_ID = "prompt_reference" as const;
export const AI_VIDEO_OUTPUT_ID = "videos" as const;
export const AI_VIDEO_RESULT_INPUT_ID = "videos_result" as const;
export const AI_VIDEO_HISTORY_INPUT_ID = "videos_history" as const;

/** Empty / placement default — adaptive size used once media loads. */
export const AI_VIDEO_CARD_WIDTH_PX = AI_VIDEO_EMPTY_CARD_SIZE.width;
export const AI_VIDEO_CARD_HEIGHT_PX = AI_VIDEO_EMPTY_CARD_SIZE.height;

/** Bottom editor panel — same visual size as AI text / AI image. */
export const AI_VIDEO_PANEL_WIDTH_PX = AI_GENERATIVE_PANEL_WIDTH_PX;
export const AI_VIDEO_PANEL_HEIGHT_PX = AI_GENERATIVE_PANEL_HEIGHT_PX;
export const AI_VIDEO_PANEL_PROMPT_MIN_HEIGHT_PX =
  AI_GENERATIVE_PANEL_PROMPT_MIN_HEIGHT_PX;

export const AI_VIDEO_GENERATING_META_KEY = "aiVideoGenerating" as const;
export {
  AI_VIDEO_GENERATE_ERROR_META_KEY,
  readGenerativeCardGenerateError as readAiVideoGenerateError,
  withGenerativeCardGenerateError as withAiVideoGenerateError,
} from "./generative-card-error-utils";

export const AI_VIDEO_MAX_HISTORY_ITEMS = 30;

/** Image / video / audio reference sources for multimodal video generation. */
export const AI_VIDEO_ALLOWED_REFERENCE_NODE_TYPES = [
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  AI_AUDIO_NODE_TYPE,
] as const;

export type AiVideoAllowedReferenceNodeType =
  (typeof AI_VIDEO_ALLOWED_REFERENCE_NODE_TYPES)[number];

export type AiVideoReferenceKind = "image" | "video" | "audio";

export function classifyAiVideoReferenceFromNodeType(
  nodeType: string | undefined
): AiVideoReferenceKind | null {
  if (nodeType === AI_IMAGE_NODE_TYPE) return "image";
  if (nodeType === AI_VIDEO_NODE_TYPE) return "video";
  if (nodeType === AI_AUDIO_NODE_TYPE) return "audio";
  return null;
}

export function isAiVideoAllowedReferenceNodeType(
  nodeType: string | undefined
): nodeType is AiVideoAllowedReferenceNodeType {
  return (
    nodeType === AI_IMAGE_NODE_TYPE ||
    nodeType === AI_VIDEO_NODE_TYPE ||
    nodeType === AI_AUDIO_NODE_TYPE
  );
}

function parseWorkflowMediaValues(value: unknown): WorkflowMediaValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isWorkflowMediaValue);
}

function toStoredWorkflowMedia(
  values: readonly (WorkflowMediaValue | MediaReference)[]
): WorkflowMediaValue[] {
  return values.map((value) =>
    isWorkflowMediaValue(value) ? value : mediaReferenceToWorkflowValue(value)
  );
}

function upsertInputValue(
  inputs: readonly WorkflowParameter[],
  id: string,
  value: unknown,
  type: WorkflowParameter["type"] = "string"
): WorkflowParameter[] {
  if (inputs.some((input) => input.id === id)) {
    return inputs.map((input) =>
      input.id === id ? ({ ...input, value } as WorkflowParameter) : input
    );
  }

  return [
    ...inputs,
    {
      id,
      name: id,
      type,
      hidden: true,
      value,
    } as WorkflowParameter,
  ];
}

export function mergeAiVideoNodeCatalogInputs(
  nodeType: string | undefined,
  inputs: readonly WorkflowParameter[],
  catalog: NodeType | undefined
): WorkflowParameter[] {
  if (nodeType !== AI_VIDEO_NODE_TYPE || !catalog) {
    return [...inputs];
  }

  const extraInputs: WorkflowParameter[] = [
    {
      id: AI_VIDEO_REFERENCE_HANDLE_ID,
      name: AI_VIDEO_REFERENCE_HANDLE_ID,
      type: "any",
      hidden: true,
      repeated: true,
      description: "Upstream media references for video generation.",
    },
    {
      id: AI_VIDEO_PROMPT_HANDLE_ID,
      name: AI_VIDEO_PROMPT_HANDLE_ID,
      type: "any",
      hidden: true,
      description: "Upstream text prompt reference.",
    },
    {
      id: AI_VIDEO_RESULT_INPUT_ID,
      name: AI_VIDEO_RESULT_INPUT_ID,
      type: "json",
      hidden: true,
      description: "Last generated videos shown on the canvas card.",
    },
    {
      id: AI_VIDEO_HISTORY_INPUT_ID,
      name: AI_VIDEO_HISTORY_INPUT_ID,
      type: "json",
      hidden: true,
      description: "Candidate generation results for history picker.",
    },
  ];

  const merged = inputs.map((input) =>
    input.id === "model" || input.id === "prompt"
      ? ({ ...input, hidden: true } as WorkflowParameter)
      : input
  );
  for (const templateInput of catalog.inputs) {
    const id = templateInput.name;
    if (merged.some((input) => input.id === id)) {
      continue;
    }
    const hidden =
      id === "model" ||
      id === "prompt" ||
      id === "params" ||
      id === "manual_videos" ||
      templateInput.hidden;
    merged.push({ ...templateInput, id, hidden });
  }
  for (const extra of extraInputs) {
    if (merged.some((input) => input.id === extra.id)) {
      continue;
    }
    merged.push(extra);
  }
  return merged;
}

export function readAiVideoResult(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[]
): WorkflowMediaValue[] {
  const fromInput = inputs.find(
    (input) => input.id === AI_VIDEO_RESULT_INPUT_ID
  );
  const fromInputVideos = parseWorkflowMediaValues(fromInput?.value);
  if (fromInputVideos.length > 0) {
    return fromInputVideos;
  }

  const fromOutput = outputs?.find((output) => output.id === AI_VIDEO_OUTPUT_ID);
  return parseWorkflowMediaValues(fromOutput?.value);
}

export function readAiVideoResultHistory(
  inputs: readonly WorkflowParameter[]
): AiVideoResultHistory {
  const raw = inputs.find(
    (input) => input.id === AI_VIDEO_HISTORY_INPUT_ID
  )?.value;
  if (!raw || typeof raw !== "object") {
    return { items: [], selectedId: null };
  }

  const record = raw as {
    items?: unknown;
    selectedId?: unknown;
  };
  const rawItems = Array.isArray(record.items)
    ? record.items.filter(
        (entry): entry is AiVideoResultHistoryItem =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as AiVideoResultHistoryItem).id === "string" &&
          Array.isArray((entry as AiVideoResultHistoryItem).videos) &&
          typeof (entry as AiVideoResultHistoryItem).createdAt === "string"
      )
      .map((entry) => {
        const item = entry as AiVideoResultHistoryItem & { prompt?: string };
        return {
          ...item,
          prompt: typeof item.prompt === "string" ? item.prompt : "",
        };
      })
    : [];

  const items = splitHistoryMediaRows({
    items: rawItems,
    getMedia: (item) => item.videos,
    withMedia: (item, videos) => ({ ...item, videos }),
  });

  return {
    items,
    selectedId:
      typeof record.selectedId === "string" ? record.selectedId : null,
  };
}

export function withAiVideoResult(
  current: WorkflowNodeType,
  videos: readonly WorkflowMediaValue[],
  extras?: {
    readonly inputs?: readonly WorkflowParameter[];
  }
): Partial<WorkflowNodeType> {
  const storedVideos = toStoredWorkflowMedia(videos);
  const baseInputs = extras?.inputs ?? current.inputs;
  let inputs = upsertInputValue(
    baseInputs,
    AI_VIDEO_RESULT_INPUT_ID,
    [...storedVideos],
    "json"
  );

  const history = readAiVideoResultHistory(inputs);
  if (history.selectedId) {
    const nextHistory: AiVideoResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId
          ? { ...item, videos: [...storedVideos] }
          : item
      ),
    };
    inputs = upsertInputValue(
      inputs,
      AI_VIDEO_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const outputs = current.outputs.map((output) =>
    output.id === AI_VIDEO_OUTPUT_ID
      ? ({ ...output, value: [...storedVideos] } as WorkflowParameter)
      : output
  );

  return { inputs, outputs };
}

/**
 * Card preview while cloud persist is uploading. Does not append history —
 * final success path writes the history entry.
 */
export function withAiVideoStagingPreview(
  current: WorkflowNodeType,
  videos: readonly WorkflowMediaValue[]
): Partial<WorkflowNodeType> {
  const inputs = upsertInputValue(
    current.inputs,
    AI_VIDEO_RESULT_INPUT_ID,
    [...videos],
    "json"
  );
  const outputs = current.outputs.map((output) =>
    output.id === AI_VIDEO_OUTPUT_ID
      ? ({ ...output, value: [...videos] } as WorkflowParameter)
      : output
  );
  return { inputs, outputs };
}

export function readAiVideoCardDisplay(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): GenerativeCardCoverRead<WorkflowMediaValue> {
  if (isGenerativeManualContent(metadata)) {
    const manual = parseWorkflowMediaValues(
      inputs.find((input) => input.id === "manual_videos")?.value
    );
    if (manual.length > 0) {
      return {
        coverMedia: manual,
        isBusy: false,
        hasCover: hasDisplayableWorkflowMedia(manual),
        cardPhase: null,
      };
    }

    const cardPhase = resolveGenerativeCardPhase(metadata, manual, false);
    const progressPhase = readGenerativeProgressPhase(metadata);
    return {
      coverMedia: manual,
      isBusy:
        (cardPhase !== null && isGenerativeCardBusyPhase(cardPhase)) ||
        isGenerativeProgressBusyPhase(progressPhase),
      hasCover: false,
      cardPhase,
    };
  }

  const history = readAiVideoResultHistory(inputs);
  if (history.selectedId) {
    return readGenerativeCardCoverFromHistory(history, (item) => item.videos, {
      metadata,
      isModalityGenerating: isAiVideoGenerating(metadata),
    });
  }

  const fallback = readAiVideoResult(inputs, outputs);
  const cardPhase = resolveGenerativeCardPhase(
    metadata,
    fallback,
    isAiVideoGenerating(metadata)
  );
  return {
    coverMedia: fallback,
    isBusy:
      (cardPhase !== null && isGenerativeCardBusyPhase(cardPhase)) ||
      isAiVideoGenerating(metadata) ||
      hasGeneratingResource(fallback),
    hasCover: hasDisplayableWorkflowMedia(fallback),
    cardPhase,
  };
}

export function readAiVideoCardVideos(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): WorkflowMediaValue[] {
  return [...readAiVideoCardDisplay(inputs, outputs, metadata).coverMedia];
}

/** Current card output — at most one video. */
export function readAiVideoCardPrimaryVideo(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): WorkflowMediaValue | undefined {
  return readAiVideoCardDisplay(inputs, outputs, metadata).coverMedia[0];
}

export function withAiVideoManualUpload(
  current: WorkflowNodeType,
  videos: readonly MediaReference[]
): Partial<WorkflowNodeType> {
  let inputs = upsertInputValue(
    current.inputs,
    "manual_videos",
    [...videos],
    "json"
  );
  inputs = upsertInputValue(inputs, AI_VIDEO_RESULT_INPUT_ID, [...videos], "json");

  const outputs = current.outputs.map((output) =>
    output.id === AI_VIDEO_OUTPUT_ID
      ? ({ ...output, value: [...videos] } as WorkflowParameter)
      : output
  );

  const metadata =
    videos.length > 0
      ? withGenerativeManualContentMode(current.metadata)
      : withGenerativeGeneratedContentMode(current.metadata);

  return { inputs, outputs, metadata };
}

export function withAiVideoGeneratedResult(
  current: WorkflowNodeType,
  videos: readonly MediaReference[],
  meta?: {
    readonly prompt: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
    readonly modelDisplayName?: string;
  }
): Partial<WorkflowNodeType> {
  const storedVideos = toStoredWorkflowMedia(videos);
  const primary = storedVideos[0];
  if (!primary) return {};

  return appendAiVideoGeneratedHistoryItems(current, [primary], meta);
}

/** Append one history row per video; card shows the first. */
export function appendAiVideoGeneratedHistoryItems(
  current: WorkflowNodeType,
  videos: readonly WorkflowMediaValue[],
  meta?: {
    readonly prompt: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
    readonly modelDisplayName?: string;
    readonly jobId?: string;
  }
): Partial<WorkflowNodeType> {
  if (videos.length === 0) return {};

  const storedVideos = toStoredWorkflowMedia(videos);
  const history = readAiVideoResultHistory(current.inputs);
  const pendingIndex = meta?.jobId
    ? history.items.findIndex((item) => item.jobId === meta.jobId)
    : -1;
  if (pendingIndex >= 0) {
    const pending = history.items[pendingIndex]!;
    const nextItems = history.items.map((item, index) =>
      index === pendingIndex
        ? {
            ...item,
            videos: [storedVideos[0]!],
            jobId: undefined,
          }
        : item
    );
    const nextHistory: AiVideoResultHistory = {
      items: nextItems,
      selectedId: pending.id,
    };
    let nextInputs = upsertInputValue(
      current.inputs,
      AI_VIDEO_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
    nextInputs = upsertInputValue(nextInputs, "manual_videos", [], "json");
    const result = withAiVideoResult(current, [storedVideos[0]!], {
      inputs: nextInputs,
    });
    return {
      ...result,
      metadata: withGenerativeGeneratedContentMode(current.metadata),
    };
  }

  const createdAt = new Date().toISOString();
  const batchId = Date.now();
  const newItems: AiVideoResultHistoryItem[] = storedVideos.map((video, index) => ({
    id: `gen-${batchId}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    videos: [video],
    prompt: meta?.prompt ?? "",
    params: meta?.params,
    platformModelId: meta?.platformModelId,
    aiInterfaceId: meta?.aiInterfaceId,
    providerModelId: meta?.providerModelId,
    modelDisplayName: meta?.modelDisplayName,
    createdAt,
  }));
  const primary = newItems[0]!;
  const nextHistory: AiVideoResultHistory = {
    items: [...newItems, ...history.items].slice(0, AI_VIDEO_MAX_HISTORY_ITEMS),
    selectedId: primary.id,
  };
  let inputs = upsertInputValue(
    current.inputs,
    AI_VIDEO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  inputs = upsertInputValue(inputs, "manual_videos", [], "json");
  const result = withAiVideoResult(current, [storedVideos[0]!], { inputs });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function readAiVideoGeneratingJobId(
  inputs: readonly WorkflowParameter[]
): string | undefined {
  const history = readAiVideoResultHistory(inputs);
  for (const item of history.items) {
    if (item.jobId && hasGeneratingResource(item.videos)) {
      return item.jobId;
    }
  }
  return undefined;
}

export function withAiVideoGeneratingHistory(
  current: WorkflowNodeType,
  params: {
    readonly jobId: string;
    readonly prompt: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
    readonly modelDisplayName?: string;
  }
): Partial<WorkflowNodeType> {
  const history = readAiVideoResultHistory(current.inputs);
  const item: AiVideoResultHistoryItem = {
    id: `gen-${Date.now()}-0-${Math.random().toString(36).slice(2, 8)}`,
    videos: [],
    prompt: params.prompt,
    params: params.params,
    platformModelId: params.platformModelId,
    aiInterfaceId: params.aiInterfaceId,
    providerModelId: params.providerModelId,
    modelDisplayName: params.modelDisplayName,
    createdAt: new Date().toISOString(),
    jobId: params.jobId,
  };
  const nextHistory: AiVideoResultHistory = {
    items: [item, ...history.items].slice(0, AI_VIDEO_MAX_HISTORY_ITEMS),
    selectedId: item.id,
  };
  const inputs = upsertInputValue(
    current.inputs,
    AI_VIDEO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  return {
    ...withAiVideoResult(current, [], { inputs }),
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function withAiVideoGeneratingHistoryFailed(
  current: WorkflowNodeType,
  jobId?: string | null
): Partial<WorkflowNodeType> {
  const history = readAiVideoResultHistory(current.inputs);
  const nextItems = history.items.map((item) => {
    const matchesJob = Boolean(jobId && item.jobId === jobId);
    if (!matchesJob && !hasGeneratingResource(item.videos)) {
      return item;
    }
    if (jobId && item.jobId && item.jobId !== jobId) {
      return item;
    }
    return {
      ...item,
      videos: item.videos.map((video) =>
        isResourceIdReference(video)
          ? {
              resourceId: video.resourceId,
              mimeType: video.mimeType,
              contentSha256: video.contentSha256,
              failed: true,
            }
          : video
      ),
    };
  });
  const selected =
    nextItems.find((item) => item.id === history.selectedId) ?? nextItems[0];
  const nextHistory: AiVideoResultHistory = {
    items: nextItems,
    selectedId: selected?.id ?? null,
  };
  const inputs = upsertInputValue(
    current.inputs,
    AI_VIDEO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  return withAiVideoResult(current, selected?.videos ?? [], { inputs });
}

export function withAiVideoResourcesMarkedFailed(
  current: WorkflowNodeType,
  resourceIds: readonly string[]
): Partial<WorkflowNodeType> {
  const ids = new Set(resourceIds);
  if (ids.size === 0) {
    return {};
  }

  const history = readAiVideoResultHistory(current.inputs);
  const nextHistory: AiVideoResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      videos: item.videos.map((video) =>
        isResourceIdReference(video) && ids.has(video.resourceId)
          ? markResourceRefFailed(video)
          : video
      ),
    })),
  };

  const inputs = upsertInputValue(
    current.inputs,
    AI_VIDEO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const resultVideos = readAiVideoResult(inputs, current.outputs).map((video) =>
    isResourceIdReference(video) && ids.has(video.resourceId)
      ? markResourceRefFailed(video)
      : video
  );
  return withAiVideoResult(current, resultVideos, { inputs });
}

export function withAiVideoResourceGeneratingCleared(
  current: WorkflowNodeType,
  resourceIds: readonly string[]
): Partial<WorkflowNodeType> {
  const ids = new Set(resourceIds);
  if (ids.size === 0) {
    return {};
  }

  const history = readAiVideoResultHistory(current.inputs);
  const nextHistory: AiVideoResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      videos: item.videos.map((video) => {
        if (
          isResourceIdReference(video) &&
          video.generating &&
          ids.has(video.resourceId)
        ) {
          return stripGeneratingFlag(video);
        }
        return video;
      }),
    })),
  };

  const inputs = upsertInputValue(
    current.inputs,
    AI_VIDEO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const resultVideos = readAiVideoResult(inputs, current.outputs).map((video) => {
    if (
      isResourceIdReference(video) &&
      video.generating &&
      ids.has(video.resourceId)
    ) {
      return stripGeneratingFlag(video);
    }
    return video;
  });
  return withAiVideoResult(current, resultVideos, { inputs });
}

export function withAiVideoResourceKinds(
  current: WorkflowNodeType,
  kindsById: ReadonlyMap<string, MediaResourceKind>
): Partial<WorkflowNodeType> {
  if (kindsById.size === 0) {
    return {};
  }

  const history = readAiVideoResultHistory(current.inputs);
  const nextHistory: AiVideoResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      videos: mapMediaResourceKinds(item.videos, kindsById),
    })),
  };
  const historyChanged = nextHistory.items.some(
    (item, index) => item.videos !== history.items[index]!.videos
  );

  let inputs = current.inputs;
  if (historyChanged) {
    inputs = upsertInputValue(
      current.inputs,
      AI_VIDEO_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const resultVideos = readAiVideoResult(inputs, current.outputs);
  const nextResult = mapMediaResourceKinds(resultVideos, kindsById);
  if (!historyChanged && nextResult === resultVideos) {
    return {};
  }
  return withAiVideoResult(current, [...nextResult], { inputs });
}

export function withAiVideoHistorySelection(
  current: WorkflowNodeType,
  selectedId: string,
  options?: {
    readonly models?: readonly OrgVideoModelOption[];
  }
): GenerativeHistorySelectionResult {
  const history = readAiVideoResultHistory(current.inputs);
  const selected = history.items.find((entry) => entry.id === selectedId);
  if (!selected) return {};

  const settings = options?.models
    ? applyHistoryItemSettingsToNode({
        current,
        modality: "video",
        models: options.models,
        historyBinding: selected,
        historyParams: selected.params,
      })
    : { patch: {}, modelUnavailable: false };

  const working: WorkflowNodeType = {
    ...current,
    inputs: settings.patch.inputs ?? current.inputs,
    metadata: settings.patch.metadata ?? current.metadata,
  };

  const nextInputs = upsertInputValue(
    working.inputs,
    "prompt",
    selected.prompt,
    "string"
  );

  const result = withAiVideoResult(working, selected.videos.slice(0, 1), {
    inputs: upsertInputValue(
      nextInputs,
      AI_VIDEO_HISTORY_INPUT_ID,
      { items: history.items, selectedId },
      "json"
    ),
  });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode({
      ...(settings.patch.metadata ?? current.metadata),
    }),
    modelUnavailable: settings.modelUnavailable,
  };
}

export function isAiVideoGenerating(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[AI_VIDEO_GENERATING_META_KEY] === "1";
}

export function withAiVideoGeneratingFlag(
  metadata: Record<string, string> | undefined,
  generating: boolean
): Record<string, string> | undefined {
  if (generating) {
    return { ...(metadata ?? {}), [AI_VIDEO_GENERATING_META_KEY]: "1" };
  }

  if (!metadata || !(AI_VIDEO_GENERATING_META_KEY in metadata)) {
    return metadata;
  }

  const next = { ...metadata };
  delete next[AI_VIDEO_GENERATING_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function countAiVideoReferenceCounts(
  targetNodeId: string,
  edges: readonly {
    readonly source: string;
    readonly target: string;
    readonly targetHandle?: string | null;
  }[],
  nodes: readonly { readonly id: string; readonly data: WorkflowNodeType }[]
): SubmitAiVideoMediaReferenceCounts {
  const counts: SubmitAiVideoMediaReferenceCounts = {
    imageCount: 0,
    videoCount: 0,
    audioCount: 0,
  };

  for (const edge of edges) {
    if (
      edge.target !== targetNodeId ||
      edge.targetHandle !== AI_VIDEO_REFERENCE_HANDLE_ID
    ) {
      continue;
    }
    const source = nodes.find((node) => node.id === edge.source);
    const kind = classifyAiVideoReferenceFromNodeType(source?.data.nodeType);
    if (kind === "image") counts.imageCount += 1;
    else if (kind === "video") counts.videoCount += 1;
    else if (kind === "audio") counts.audioCount += 1;
  }

  return counts;
}

/** @deprecated Prefer countAiVideoReferenceCounts. */
export function countAiVideoReferences(
  targetNodeId: string,
  edges: readonly {
    readonly source: string;
    readonly target: string;
    readonly targetHandle?: string | null;
  }[]
): number {
  const imageCount = edges.filter(
    (edge) =>
      edge.target === targetNodeId &&
      edge.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
  ).length;
  return imageCount;
}

export function referencesFitVideoModelLimits(
  counts: SubmitAiVideoMediaReferenceCounts,
  rules: VideoModelParameterRules
): boolean {
  return referencesFitVideoModelReferenceLimits(counts, rules);
}

/** Model allows image / video / audio references in generation params. */
export function videoModelAllowsMediaReferences(
  rules: VideoModelParameterRules
): boolean {
  const normalized = normalizeVideoModelParameterRules(rules);
  return (
    normalized.maxReferenceImages > 0 ||
    normalized.maxReferenceVideos > 0 ||
    normalized.maxReferenceAudios > 0
  );
}

/** Prompt text or connected media references satisfy the generate gate. */
export function canGenerateAiVideo(params: {
  readonly prompt: string;
  readonly referenceCounts: SubmitAiVideoMediaReferenceCounts;
  readonly rules: VideoModelParameterRules;
  readonly blocksGenerativeMedia?: boolean;
}): boolean {
  if (params.blocksGenerativeMedia) return false;
  if (params.prompt.trim().length > 0) return true;
  if (!videoModelAllowsMediaReferences(params.rules)) return false;
  const total =
    params.referenceCounts.imageCount +
    params.referenceCounts.videoCount +
    params.referenceCounts.audioCount;
  return total > 0;
}

export function pickDefaultVideoModelCanonicalId(
  models: readonly {
    readonly canonicalId: string;
    readonly selectable: boolean;
  }[]
): string | undefined {
  const selectable = models.filter((entry) => entry.selectable);
  return selectable[0]?.canonicalId;
}

export function isAiVideoReferenceTarget(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return (
    nodeType === AI_VIDEO_NODE_TYPE &&
    handleId === AI_VIDEO_REFERENCE_HANDLE_ID
  );
}

export function isAiVideoOutputHandle(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_VIDEO_NODE_TYPE && handleId === AI_VIDEO_OUTPUT_ID;
}
