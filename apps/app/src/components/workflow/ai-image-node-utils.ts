import {
  AI_IMAGE_NODE_TYPE,
  type AiImageResultHistory,
  type AiImageResultHistoryItem,
  type ImageGenerationRequestSnapshot,
  normalizeImageModelParameterRules,
  type ImageModelParameterRules,
  type OrgImageModelOption,
  hasGeneratingResource,
  hasDisplayableWorkflowMedia,
  isResourceIdReference,
  isWorkflowMediaValue,
  mediaReferenceToWorkflowValue,
  type MediaReference,
  type MediaResourceKind,
  type ResourceIdReference,
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
import { isGenerativeCardBusyPhase } from "./generative-progress-utils";

import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  MEDIA_CARD_SHORT_SIDE_PX,
} from "./media-card-size";
import {
  mapMediaResourceKinds,
  markResourceRefFailed,
  stripGeneratingFlag,
} from "./generative-resource-ref-utils";

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

function parseWorkflowMediaValues(value: unknown): WorkflowMediaValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isWorkflowMediaValue);
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
): WorkflowMediaValue[] {
  const fromInput = inputs.find(
    (input) => input.id === AI_IMAGE_RESULT_INPUT_ID
  );
  const fromInputImages = parseWorkflowMediaValues(fromInput?.value);
  if (fromInputImages.length > 0) {
    return fromInputImages;
  }

  const fromOutput = outputs?.find((output) => output.id === AI_IMAGE_OUTPUT_ID);
  return parseWorkflowMediaValues(fromOutput?.value);
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
  const rawItems = Array.isArray(record.items)
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

  const items = splitHistoryMediaRows({
    items: rawItems,
    getMedia: (item) => item.images,
    withMedia: (item, images) => ({ ...item, images }),
  });

  return {
    items,
    selectedId:
      typeof record.selectedId === "string" ? record.selectedId : null,
  };
}

function toStoredWorkflowMedia(
  images: readonly (WorkflowMediaValue | MediaReference)[]
): WorkflowMediaValue[] {
  return images.map((image) => {
    const stored = isWorkflowMediaValue(image)
      ? image
      : mediaReferenceToWorkflowValue(image);
    if (!isResourceIdReference(stored)) {
      return stored;
    }
    const {
      generating: _generating,
      cloudAccelerationStatus: _cloudAccelerationStatus,
      failed: _failed,
      ...rest
    } = stored;
    return rest;
  });
}

export function withAiImageResult(
  current: WorkflowNodeType,
  images: readonly WorkflowMediaValue[],
  extras?: {
    readonly inputs?: readonly WorkflowParameter[];
  }
): Partial<WorkflowNodeType> {
  const storedImages = toStoredWorkflowMedia(images);
  const baseInputs = extras?.inputs ?? current.inputs;
  let inputs = upsertInputValue(
    baseInputs,
    AI_IMAGE_RESULT_INPUT_ID,
    [...storedImages],
    "json"
  );

  const history = readAiImageResultHistory(inputs);
  if (history.selectedId) {
    const nextHistory: AiImageResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId ? { ...item, images: [...storedImages] } : item
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
      ? ({ ...output, value: [...storedImages] } as WorkflowParameter)
      : output
  );

  return { inputs, outputs };
}

export function withAiImageGeneratingHistory(
  current: WorkflowNodeType,
  params: {
    readonly resourceIds: readonly string[];
    readonly prompt: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
    readonly modelDisplayName?: string;
    readonly jobId?: string;
  }
): Partial<WorkflowNodeType> {
  if (params.resourceIds.length === 0) {
    return {};
  }

  const history = readAiImageResultHistory(current.inputs);
  const createdAt = new Date().toISOString();
  const batchId = Date.now();
  const newItems: AiImageResultHistoryItem[] = params.resourceIds.map(
    (resourceId, index) => ({
      id: `gen-${batchId}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      images: [
        {
          resourceId,
          mimeType: "image/png",
          generating: true,
          kind: "ephemeral",
        },
      ],
      prompt: params.prompt,
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
    items: [...newItems, ...history.items].slice(0, AI_IMAGE_MAX_HISTORY_ITEMS),
    selectedId: primary.id,
  };

  let inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  inputs = upsertInputValue(inputs, "manual_images", [], "json");
  return {
    ...withAiImageResult(current, primary.images, { inputs }),
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function readAiImageGeneratingJobId(
  inputs: readonly WorkflowParameter[]
): string | undefined {
  const history = readAiImageResultHistory(inputs);
  for (const item of history.items) {
    if (item.jobId && hasGeneratingResource(item.images)) {
      return item.jobId;
    }
  }
  return undefined;
}

export function withAiImageResourceGeneratingCleared(
  current: WorkflowNodeType,
  resourceIds: readonly string[]
): Partial<WorkflowNodeType> {
  const ids = new Set(resourceIds);
  if (ids.size === 0) {
    return {};
  }

  const history = readAiImageResultHistory(current.inputs);
  const nextHistory: AiImageResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      images: item.images.map((image) => {
        if (
          isResourceIdReference(image) &&
          image.generating &&
          ids.has(image.resourceId)
        ) {
          return stripGeneratingFlag(image);
        }
        return image;
      }),
    })),
  };

  let inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const resultImages = readAiImageResult(inputs, current.outputs).map((image) => {
    if (
      isResourceIdReference(image) &&
      image.generating &&
      ids.has(image.resourceId)
    ) {
      return stripGeneratingFlag(image);
    }
    return image;
  });
  return withAiImageResult(current, resultImages, { inputs });
}

export function withAiImageResourceKinds(
  current: WorkflowNodeType,
  kindsById: ReadonlyMap<string, MediaResourceKind>
): Partial<WorkflowNodeType> {
  if (kindsById.size === 0) {
    return {};
  }

  const history = readAiImageResultHistory(current.inputs);
  const nextHistory: AiImageResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      images: mapMediaResourceKinds(item.images, kindsById),
    })),
  };
  const historyChanged = nextHistory.items.some(
    (item, index) => item.images !== history.items[index]!.images
  );

  let inputs = current.inputs;
  if (historyChanged) {
    inputs = upsertInputValue(
      current.inputs,
      AI_IMAGE_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const resultImages = readAiImageResult(inputs, current.outputs);
  const nextResult = mapMediaResourceKinds(resultImages, kindsById);
  if (!historyChanged && nextResult === resultImages) {
    return {};
  }
  return withAiImageResult(current, [...nextResult], { inputs });
}

export function withAiImageGeneratingHistoryFailed(
  current: WorkflowNodeType,
  jobId?: string | null
): Partial<WorkflowNodeType> {
  const history = readAiImageResultHistory(current.inputs);
  const nextItems = history.items.map((item) => {
    const matchesJob = Boolean(jobId && item.jobId === jobId);
    if (!matchesJob && !hasGeneratingResource(item.images)) {
      return item;
    }
    if (jobId && item.jobId && item.jobId !== jobId) {
      return item;
    }
    return {
      ...item,
      images: item.images.map(markResourceRefFailed),
    };
  });
  const selected =
    nextItems.find((item) => item.id === history.selectedId) ?? nextItems[0];
  const nextHistory: AiImageResultHistory = {
    items: nextItems,
    selectedId: selected?.id ?? null,
  };
  let inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const selectedImages = selected?.images ?? [];
  return withAiImageResult(current, selectedImages, { inputs });
}

export function withAiImageResourcesMarkedFailed(
  current: WorkflowNodeType,
  resourceIds: readonly string[]
): Partial<WorkflowNodeType> {
  const ids = new Set(resourceIds);
  if (ids.size === 0) {
    return {};
  }

  const history = readAiImageResultHistory(current.inputs);
  const nextHistory: AiImageResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      images: item.images.map((image) =>
        isResourceIdReference(image) && ids.has(image.resourceId)
          ? markResourceRefFailed(image)
          : image
      ),
    })),
  };

  let inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const resultImages = readAiImageResult(inputs, current.outputs).map((image) =>
    isResourceIdReference(image) && ids.has(image.resourceId)
      ? markResourceRefFailed(image)
      : image
  );
  return withAiImageResult(current, resultImages, { inputs });
}

export function isAiImageResourceGenerating(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[]
): boolean {
  return hasGeneratingResource(readAiImageResult(inputs, outputs));
}

/**
 * Card preview while cloud persist is uploading. Does not append history —
 * final success path writes the single history entry.
 */
export function withAiImageStagingPreview(
  current: WorkflowNodeType,
  images: readonly WorkflowMediaValue[]
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

export function readAiImageCardDisplay(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): GenerativeCardCoverRead<WorkflowMediaValue> {
  if (isGenerativeManualContent(metadata)) {
    const manual = parseWorkflowMediaValues(
      inputs.find((input) => input.id === "manual_images")?.value
    );
    if (manual.length > 0) {
      return {
        coverMedia: manual,
        isBusy: false,
        hasCover: hasDisplayableWorkflowMedia(manual),
        cardPhase: null,
      };
    }
  }

  const history = readAiImageResultHistory(inputs);
  if (history.selectedId) {
    return readGenerativeCardCoverFromHistory(history, (item) => item.images, {
      metadata,
      isModalityGenerating: isAiImageGenerating(metadata),
    });
  }

  const fallback = readAiImageResult(inputs, outputs);
  const cardPhase = resolveGenerativeCardPhase(
    metadata,
    fallback,
    isAiImageGenerating(metadata)
  );
  return {
    coverMedia: fallback,
    isBusy:
      (cardPhase !== null && isGenerativeCardBusyPhase(cardPhase)) ||
      isAiImageGenerating(metadata) ||
      hasGeneratingResource(fallback),
    hasCover: hasDisplayableWorkflowMedia(fallback),
    cardPhase,
  };
}

export function readAiImageCardImages(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): WorkflowMediaValue[] {
  return [...readAiImageCardDisplay(inputs, outputs, metadata).coverMedia];
}

/** Current card output — at most one image. */
export function readAiImageCardPrimaryImage(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): WorkflowMediaValue | undefined {
  return readAiImageCardDisplay(inputs, outputs, metadata).coverMedia[0];
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
  images: readonly (WorkflowMediaValue | MediaReference | ResourceIdReference)[],
  meta?: {
    readonly prompt: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
    readonly modelDisplayName?: string;
    readonly requestSnapshot?: ImageGenerationRequestSnapshot;
    readonly jobId?: string;
  }
): Partial<WorkflowNodeType> {
  const storedImages = toStoredWorkflowMedia(images);
  if (storedImages.length === 0) return {};

  const history = readAiImageResultHistory(current.inputs);
  const pendingItems = history.items.filter((item) => {
    if (meta?.jobId) {
      return (
        item.jobId === meta.jobId ||
        (!item.jobId && hasGeneratingResource(item.images))
      );
    }
    return hasGeneratingResource(item.images);
  });

  if (pendingItems.length > 0) {
    const pendingIds = new Set(pendingItems.map((item) => item.id));
    let storedIndex = 0;
    const items = history.items.map((item) => {
      if (!pendingIds.has(item.id)) {
        return item;
      }
      const image = storedImages[storedIndex];
      storedIndex += 1;
      if (!image) {
        return {
          ...item,
          images: item.images.map(stripGeneratingFlag),
          jobId: undefined,
        };
      }
      return {
        ...item,
        images: [image],
        jobId: undefined,
        prompt: meta?.prompt ?? item.prompt,
        params: meta?.params ?? item.params,
        platformModelId: meta?.platformModelId ?? item.platformModelId,
        aiInterfaceId: meta?.aiInterfaceId ?? item.aiInterfaceId,
        providerModelId: meta?.providerModelId ?? item.providerModelId,
        modelDisplayName: meta?.modelDisplayName ?? item.modelDisplayName,
        requestSnapshot: meta?.requestSnapshot ?? item.requestSnapshot,
      };
    });
    const extraItems: AiImageResultHistoryItem[] = storedImages
      .slice(storedIndex)
      .map((image, index) => ({
        id: `gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        images: [image],
        prompt: meta?.prompt ?? pendingItems[0]?.prompt ?? "",
        params: meta?.params ?? pendingItems[0]?.params,
        platformModelId: meta?.platformModelId ?? pendingItems[0]?.platformModelId,
        aiInterfaceId: meta?.aiInterfaceId ?? pendingItems[0]?.aiInterfaceId,
        providerModelId: meta?.providerModelId ?? pendingItems[0]?.providerModelId,
        modelDisplayName:
          meta?.modelDisplayName ?? pendingItems[0]?.modelDisplayName,
        requestSnapshot:
          meta?.requestSnapshot ?? pendingItems[0]?.requestSnapshot,
        createdAt: new Date().toISOString(),
      }));
    const primaryId = pendingItems[0]!.id;
    const nextHistory: AiImageResultHistory = {
      items: [...extraItems, ...items].slice(0, AI_IMAGE_MAX_HISTORY_ITEMS),
      selectedId: primaryId,
    };
    let inputs = upsertInputValue(
      current.inputs,
      AI_IMAGE_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
    inputs = upsertInputValue(inputs, "manual_images", [], "json");
    const result = withAiImageResult(current, [storedImages[0]!], { inputs });
    return {
      ...result,
      metadata: withGenerativeGeneratedContentMode(current.metadata),
    };
  }

  const createdAt = new Date().toISOString();
  const batchId = Date.now();
  const newItems: AiImageResultHistoryItem[] = storedImages.map((image, index) => ({
    id: `gen-${batchId}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    images: [image],
    prompt: meta?.prompt ?? "",
    params: meta?.params,
    platformModelId: meta?.platformModelId,
    aiInterfaceId: meta?.aiInterfaceId,
    providerModelId: meta?.providerModelId,
    modelDisplayName: meta?.modelDisplayName,
    requestSnapshot: meta?.requestSnapshot,
    createdAt,
  }));
  const primary = newItems[0]!;
  const nextHistory: AiImageResultHistory = {
    items: [...newItems, ...history.items].slice(0, AI_IMAGE_MAX_HISTORY_ITEMS),
    selectedId: primary.id,
  };

  let inputs = upsertInputValue(
    current.inputs,
    AI_IMAGE_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  inputs = upsertInputValue(inputs, "manual_images", [], "json");

  const result = withAiImageResult(current, [storedImages[0]!], { inputs });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function withAiImageHistorySelection(
  current: WorkflowNodeType,
  selectedId: string,
  options?: {
    readonly models?: readonly OrgImageModelOption[];
  }
): GenerativeHistorySelectionResult {
  const history = readAiImageResultHistory(current.inputs);
  const selected = history.items.find((entry) => entry.id === selectedId);
  if (!selected) return {};

  const settings = options?.models
    ? applyHistoryItemSettingsToNode({
        current,
        modality: "image",
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

  const result = withAiImageResult(working, selected.images.slice(0, 1), {
    inputs: upsertInputValue(
      nextInputs,
      AI_IMAGE_HISTORY_INPUT_ID,
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
