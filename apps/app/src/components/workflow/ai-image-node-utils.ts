import {
  AI_IMAGE_NODE_TYPE,
  type AiImageResultHistory,
  type AiImageResultHistoryItem,
  normalizeImageModelParameterRules,
  type ImageModelParameterRules,
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

import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  MEDIA_CARD_SHORT_SIDE_PX,
} from "./media-card-size";

export const AI_IMAGE_REFERENCE_HANDLE_ID = "reference_images" as const;
export const AI_IMAGE_PROMPT_HANDLE_ID = "prompt_reference" as const;
export const AI_IMAGE_OUTPUT_ID = "images" as const;
export const AI_IMAGE_RESULT_INPUT_ID = "images_result" as const;
export const AI_IMAGE_HISTORY_INPUT_ID = "images_history" as const;

/** Empty / placement default — adaptive size used once media loads. */
export const AI_IMAGE_CARD_WIDTH_PX = AI_IMAGE_EMPTY_CARD_SIZE.width;
export const AI_IMAGE_CARD_HEIGHT_PX = AI_IMAGE_EMPTY_CARD_SIZE.height;
export { MEDIA_CARD_SHORT_SIDE_PX };

/** Bottom editor panel — same visual size as AI text. */
export const AI_IMAGE_PANEL_WIDTH_PX = AI_GENERATIVE_PANEL_WIDTH_PX;
export const AI_IMAGE_PANEL_HEIGHT_PX = AI_GENERATIVE_PANEL_HEIGHT_PX;
export const AI_IMAGE_PANEL_PROMPT_MIN_HEIGHT_PX =
  AI_GENERATIVE_PANEL_PROMPT_MIN_HEIGHT_PX;

export const AI_IMAGE_GENERATING_META_KEY = "aiImageGenerating" as const;
export {
  AI_IMAGE_GENERATE_ERROR_META_KEY,
  readGenerativeCardGenerateError as readAiImageGenerateError,
  withGenerativeCardGenerateError as withAiImageGenerateError,
} from "./generative-card-error-utils";

export const AI_IMAGE_MAX_HISTORY_ITEMS = 30;

export const AI_IMAGE_ALLOWED_REFERENCE_NODE_TYPES = [
  AI_IMAGE_NODE_TYPE,
] as const;

export type AiImageAllowedReferenceNodeType =
  (typeof AI_IMAGE_ALLOWED_REFERENCE_NODE_TYPES)[number];

export function isAiImageAllowedReferenceNodeType(
  nodeType: string | undefined
): nodeType is AiImageAllowedReferenceNodeType {
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

export function mergeAiImageNodeCatalogInputs(
  nodeType: string | undefined,
  inputs: readonly WorkflowParameter[],
  catalog: NodeType | undefined
): WorkflowParameter[] {
  if (nodeType !== AI_IMAGE_NODE_TYPE || !catalog) {
    return [...inputs];
  }

  const extraInputs: WorkflowParameter[] = [
    {
      id: AI_IMAGE_REFERENCE_HANDLE_ID,
      name: AI_IMAGE_REFERENCE_HANDLE_ID,
      type: "any",
      hidden: true,
      repeated: true,
      description: "Upstream image references.",
    },
    {
      id: AI_IMAGE_PROMPT_HANDLE_ID,
      name: AI_IMAGE_PROMPT_HANDLE_ID,
      type: "any",
      hidden: true,
      description: "Upstream text prompt reference.",
    },
    {
      id: AI_IMAGE_RESULT_INPUT_ID,
      name: AI_IMAGE_RESULT_INPUT_ID,
      type: "json",
      hidden: true,
      description: "Last generated images shown on the canvas card.",
    },
    {
      id: AI_IMAGE_HISTORY_INPUT_ID,
      name: AI_IMAGE_HISTORY_INPUT_ID,
      type: "json",
      hidden: true,
      description: "Candidate generation results for history picker.",
    },
  ];

  const merged = inputs.map((input) =>
    input.id === "model" || input.id === "prompt" || input.id === "count"
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
      id === "count" ||
      id === "params" ||
      id === "manual_images" ||
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

export function readAiImageResult(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[]
): MediaReference[] {
  const fromInput = inputs.find(
    (input) => input.id === AI_IMAGE_RESULT_INPUT_ID
  );
  const fromInputImages = parseMediaReferences(fromInput?.value);
  if (fromInputImages.length > 0) {
    return fromInputImages;
  }

  const fromOutput = outputs?.find((output) => output.id === AI_IMAGE_OUTPUT_ID);
  return parseMediaReferences(fromOutput?.value);
}

export function readAiImageResultHistory(
  inputs: readonly WorkflowParameter[]
): AiImageResultHistory {
  const raw = inputs.find(
    (input) => input.id === AI_IMAGE_HISTORY_INPUT_ID
  )?.value;
  if (!raw || typeof raw !== "object") {
    return { items: [], selectedId: null };
  }

  const record = raw as {
    items?: unknown;
    selectedId?: unknown;
  };
  const items = Array.isArray(record.items)
    ? record.items.filter(
        (entry): entry is AiImageResultHistoryItem =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as AiImageResultHistoryItem).id === "string" &&
          Array.isArray((entry as AiImageResultHistoryItem).images) &&
          typeof (entry as AiImageResultHistoryItem).createdAt === "string"
      )
      .map((entry) => {
        const item = entry as AiImageResultHistoryItem & { prompt?: string };
        return {
          ...item,
          prompt: typeof item.prompt === "string" ? item.prompt : "",
        };
      })
    : [];

  return {
    items,
    selectedId:
      typeof record.selectedId === "string" ? record.selectedId : null,
  };
}

export function withAiImageResult(
  current: WorkflowNodeType,
  images: readonly MediaReference[],
  extras?: {
    readonly inputs?: readonly WorkflowParameter[];
  }
): Partial<WorkflowNodeType> {
  const baseInputs = extras?.inputs ?? current.inputs;
  let inputs = upsertInputValue(
    baseInputs,
    AI_IMAGE_RESULT_INPUT_ID,
    [...images],
    "json"
  );

  const history = readAiImageResultHistory(inputs);
  if (history.selectedId) {
    const nextHistory: AiImageResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId ? { ...item, images: [...images] } : item
      ),
    };
    inputs = upsertInputValue(
      inputs,
      AI_IMAGE_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const outputs = current.outputs.map((output) =>
    output.id === AI_IMAGE_OUTPUT_ID
      ? ({ ...output, value: [...images] } as WorkflowParameter)
      : output
  );

  return { inputs, outputs };
}

/**
 * Card preview while cloud persist is uploading. Does not append history —
 * final success path writes the single history entry.
 */
export function withAiImageStagingPreview(
  current: WorkflowNodeType,
  images: readonly MediaReference[]
): Partial<WorkflowNodeType> {
  const inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_RESULT_INPUT_ID,
    [...images],
    "json"
  );
  const outputs = current.outputs.map((output) =>
    output.id === AI_IMAGE_OUTPUT_ID
      ? ({ ...output, value: [...images] } as WorkflowParameter)
      : output
  );
  return { inputs, outputs };
}

export function readAiImageCardImages(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): MediaReference[] {
  if (isGenerativeManualContent(metadata)) {
    const manual = parseMediaReferences(
      inputs.find((input) => input.id === "manual_images")?.value
    );
    if (manual.length > 0) {
      return manual;
    }
  }

  return readAiImageResult(inputs, outputs);
}

export function withAiImageManualUpload(
  current: WorkflowNodeType,
  images: readonly MediaReference[]
): Partial<WorkflowNodeType> {
  let inputs = upsertInputValue(
    current.inputs,
    "manual_images",
    [...images],
    "json"
  );
  inputs = upsertInputValue(inputs, AI_IMAGE_RESULT_INPUT_ID, [...images], "json");

  const outputs = current.outputs.map((output) =>
    output.id === AI_IMAGE_OUTPUT_ID
      ? ({ ...output, value: [...images] } as WorkflowParameter)
      : output
  );

  const metadata =
    images.length > 0
      ? withGenerativeManualContentMode(current.metadata)
      : withGenerativeGeneratedContentMode(current.metadata);

  return { inputs, outputs, metadata };
}

export function withAiImageGeneratedResult(
  current: WorkflowNodeType,
  images: readonly MediaReference[],
  meta?: {
    readonly prompt: string;
    readonly params?: Readonly<Record<string, unknown>>;
  }
): Partial<WorkflowNodeType> {
  const history = readAiImageResultHistory(current.inputs);
  const item: AiImageResultHistoryItem = {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    images: [...images],
    prompt: meta?.prompt ?? "",
    params: meta?.params,
    createdAt: new Date().toISOString(),
  };
  const nextHistory: AiImageResultHistory = {
    items: [item, ...history.items].slice(0, AI_IMAGE_MAX_HISTORY_ITEMS),
    selectedId: item.id,
  };

  let inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  inputs = upsertInputValue(inputs, "manual_images", [], "json");

  const result = withAiImageResult(current, images, { inputs });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function withAiImageHistorySelection(
  current: WorkflowNodeType,
  selectedId: string
): Partial<WorkflowNodeType> {
  const history = readAiImageResultHistory(current.inputs);
  const selected = history.items.find((entry) => entry.id === selectedId);
  if (!selected) return {};

  const promptInputs = upsertInputValue(
    current.inputs,
    "prompt",
    selected.prompt,
    "string"
  );
  const paramsInputs =
    selected.params !== undefined
      ? upsertInputValue(promptInputs, "params", selected.params, "json")
      : promptInputs;

  const result = withAiImageResult(current, selected.images, {
    inputs: upsertInputValue(
      paramsInputs,
      AI_IMAGE_HISTORY_INPUT_ID,
      { items: history.items, selectedId },
      "json"
    ),
  });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function isAiImageGenerating(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[AI_IMAGE_GENERATING_META_KEY] === "1";
}

export function withAiImageGeneratingFlag(
  metadata: Record<string, string> | undefined,
  generating: boolean
): Record<string, string> | undefined {
  if (generating) {
    return { ...(metadata ?? {}), [AI_IMAGE_GENERATING_META_KEY]: "1" };
  }

  if (!metadata || !(AI_IMAGE_GENERATING_META_KEY in metadata)) {
    return metadata;
  }

  const next = { ...metadata };
  delete next[AI_IMAGE_GENERATING_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function countAiImageReferences(
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
      edge.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID
  ).length;
}

export function referencesFitImageModelLimits(
  referenceCount: number,
  rules: ImageModelParameterRules
): boolean {
  return referenceCount <= rules.maxReferenceImages;
}

export function imageModelAllowsMediaReferences(
  rules: ImageModelParameterRules
): boolean {
  return normalizeImageModelParameterRules(rules).maxReferenceImages > 0;
}

export function canGenerateAiImage(params: {
  readonly prompt: string;
  readonly referenceCount: number;
  readonly rules: ImageModelParameterRules;
  readonly blocksGenerativeMedia?: boolean;
}): boolean {
  if (params.blocksGenerativeMedia) return false;
  if (params.prompt.trim().length > 0) return true;
  if (!imageModelAllowsMediaReferences(params.rules)) return false;
  return params.referenceCount > 0;
}

export function pickDefaultImageModelCanonicalId(
  models: readonly {
    readonly canonicalId: string;
    readonly selectable: boolean;
  }[]
): string | undefined {
  const selectable = models.filter((entry) => entry.selectable);
  return selectable[0]?.canonicalId;
}

export function isAiImageReferenceTarget(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return (
    nodeType === AI_IMAGE_NODE_TYPE &&
    handleId === AI_IMAGE_REFERENCE_HANDLE_ID
  );
}

export function isAiImageOutputHandle(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_IMAGE_NODE_TYPE && handleId === AI_IMAGE_OUTPUT_ID;
}
