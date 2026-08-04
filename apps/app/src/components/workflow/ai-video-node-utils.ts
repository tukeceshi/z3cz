import {
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type AiVideoResultHistory,
  type AiVideoResultHistoryItem,
  normalizeVideoModelParameterRules,
  type VideoModelParameterRules,
  isMediaReference,
  type MediaReference,
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
import { splitHistoryMediaRows } from "./generative-history-utils";

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

/** Image-to-video reference sources. */
export const AI_VIDEO_ALLOWED_REFERENCE_NODE_TYPES = [
  AI_IMAGE_NODE_TYPE,
] as const;

export type AiVideoAllowedReferenceNodeType =
  (typeof AI_VIDEO_ALLOWED_REFERENCE_NODE_TYPES)[number];

export function isAiVideoAllowedReferenceNodeType(
  nodeType: string | undefined
): nodeType is AiVideoAllowedReferenceNodeType {
  return nodeType === AI_IMAGE_NODE_TYPE;
}

function parseMediaReferences(value: unknown): MediaReference[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isMediaReference);
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
      description: "Upstream image references for image-to-video.",
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
): MediaReference[] {
  const fromInput = inputs.find(
    (input) => input.id === AI_VIDEO_RESULT_INPUT_ID
  );
  const fromInputVideos = parseMediaReferences(fromInput?.value);
  if (fromInputVideos.length > 0) {
    return fromInputVideos;
  }

  const fromOutput = outputs?.find((output) => output.id === AI_VIDEO_OUTPUT_ID);
  return parseMediaReferences(fromOutput?.value);
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
  videos: readonly MediaReference[],
  extras?: {
    readonly inputs?: readonly WorkflowParameter[];
  }
): Partial<WorkflowNodeType> {
  const baseInputs = extras?.inputs ?? current.inputs;
  let inputs = upsertInputValue(
    baseInputs,
    AI_VIDEO_RESULT_INPUT_ID,
    [...videos],
    "json"
  );

  const history = readAiVideoResultHistory(inputs);
  if (history.selectedId) {
    const nextHistory: AiVideoResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId ? { ...item, videos: [...videos] } : item
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
      ? ({ ...output, value: [...videos] } as WorkflowParameter)
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
  videos: readonly MediaReference[]
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

export function readAiVideoCardVideos(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): MediaReference[] {
  if (isGenerativeManualContent(metadata)) {
    const manual = parseMediaReferences(
      inputs.find((input) => input.id === "manual_videos")?.value
    );
    if (manual.length > 0) {
      return manual;
    }
  }

  return readAiVideoResult(inputs, outputs);
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
  const primary = videos[0];
  if (!primary) return {};

  return appendAiVideoGeneratedHistoryItems(current, [primary], meta);
}

/** Append one history row per video; card shows the first. */
export function appendAiVideoGeneratedHistoryItems(
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
  if (videos.length === 0) return {};

  const history = readAiVideoResultHistory(current.inputs);
  const createdAt = new Date().toISOString();
  const batchId = Date.now();
  const newItems: AiVideoResultHistoryItem[] = videos.map((video, index) => ({
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

  const result = withAiVideoResult(current, [videos[0]!], { inputs });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function withAiVideoHistorySelection(
  current: WorkflowNodeType,
  selectedId: string
): Partial<WorkflowNodeType> {
  const history = readAiVideoResultHistory(current.inputs);
  const selected = history.items.find((entry) => entry.id === selectedId);
  if (!selected) return {};

  let nextInputs = upsertInputValue(
    current.inputs,
    "prompt",
    selected.prompt,
    "string"
  );
  if (selected.params !== undefined) {
    nextInputs = upsertInputValue(nextInputs, "params", selected.params, "json");
  }

  const result = withAiVideoResult(current, selected.videos.slice(0, 1), {
    inputs: upsertInputValue(
      nextInputs,
      AI_VIDEO_HISTORY_INPUT_ID,
      { items: history.items, selectedId },
      "json"
    ),
  });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
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

export function countAiVideoReferences(
  targetNodeId: string,
  edges: readonly {
    readonly source: string;
    readonly target: string;
    readonly targetHandle?: string | null;
  }[]
): number {
  return edges.filter(
    (edge) =>
      edge.target === targetNodeId &&
      edge.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
  ).length;
}

export function referencesFitVideoModelLimits(
  referenceCount: number,
  rules: VideoModelParameterRules
): boolean {
  return referenceCount <= rules.maxReferenceImages;
}

/** Model allows image/video references in generation params. */
export function videoModelAllowsMediaReferences(
  rules: VideoModelParameterRules
): boolean {
  const normalized = normalizeVideoModelParameterRules(rules);
  return (
    normalized.maxReferenceImages > 0 || normalized.maxReferenceVideos > 0
  );
}

/** Prompt text or connected media references satisfy the generate gate. */
export function canGenerateAiVideo(params: {
  readonly prompt: string;
  readonly referenceCount: number;
  readonly rules: VideoModelParameterRules;
  readonly blocksGenerativeMedia?: boolean;
}): boolean {
  if (params.blocksGenerativeMedia) return false;
  if (params.prompt.trim().length > 0) return true;
  if (!videoModelAllowsMediaReferences(params.rules)) return false;
  return params.referenceCount > 0;
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
