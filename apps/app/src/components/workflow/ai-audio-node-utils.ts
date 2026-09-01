import {
  AI_AUDIO_NODE_TYPE,
  type MediaReference,
  DEFAULT_AUDIO_MODEL_PARAMETER_RULES,
  normalizeAudioModelParameterRules,
  type AudioModelParameterRules,
  type OrgAudioModelOption,
  hasGeneratingResource,
  hasDisplayableWorkflowMedia,
  isResourceIdReference,
  isWorkflowMediaValue,
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
import { isGenerativeCardBusyPhase } from "./generative-progress-utils";
import {
  mapMediaResourceKinds,
  markResourceRefFailed,
  stripGeneratingFlag,
} from "./generative-resource-ref-utils";

export const AI_AUDIO_PROMPT_HANDLE_ID = "prompt_reference" as const;
export const AI_AUDIO_OUTPUT_ID = "audios" as const;
export const AI_AUDIO_RESULT_INPUT_ID = "audios_result" as const;
export const AI_AUDIO_HISTORY_INPUT_ID = "audios_history" as const;

/** Canvas card size — compact audio card. */
export const AI_AUDIO_CARD_WIDTH_PX = 360;
export const AI_AUDIO_CARD_HEIGHT_PX = 144;

/** Bottom editor panel — same visual size as AI text / AI image / AI video. */
export const AI_AUDIO_PANEL_WIDTH_PX = AI_GENERATIVE_PANEL_WIDTH_PX;
export const AI_AUDIO_PANEL_HEIGHT_PX = AI_GENERATIVE_PANEL_HEIGHT_PX;
export const AI_AUDIO_PANEL_PROMPT_MIN_HEIGHT_PX =
  AI_GENERATIVE_PANEL_PROMPT_MIN_HEIGHT_PX;

export const AI_AUDIO_GENERATING_META_KEY = "aiAudioGenerating" as const;
export {
  AI_VIDEO_GENERATE_ERROR_META_KEY as AI_AUDIO_GENERATE_ERROR_META_KEY,
  readGenerativeCardGenerateError as readAiAudioGenerateError,
  withGenerativeCardGenerateError as withAiAudioGenerateError,
} from "./generative-card-error-utils";

export const AI_AUDIO_MAX_HISTORY_ITEMS = 30;

export interface AiAudioResultHistoryItem {
  readonly id: string;
  /** Always one audio per history row (legacy multi-audio rows are split on read). */
  readonly audios: readonly MediaReference[];
  readonly prompt: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly providerModelId?: string;
  readonly modelDisplayName?: string;
  readonly createdAt: string;
  readonly jobId?: string;
}

export interface AiAudioResultHistory {
  readonly items: readonly AiAudioResultHistoryItem[];
  readonly selectedId: string | null;
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

export function mergeAiAudioNodeCatalogInputs(
  nodeType: string | undefined,
  inputs: readonly WorkflowParameter[],
  catalog: NodeType | undefined
): WorkflowParameter[] {
  if (nodeType !== AI_AUDIO_NODE_TYPE || !catalog) {
    return [...inputs];
  }

  const extraInputs: WorkflowParameter[] = [
    {
      id: AI_AUDIO_PROMPT_HANDLE_ID,
      name: AI_AUDIO_PROMPT_HANDLE_ID,
      type: "any",
      hidden: true,
      description: "Upstream text prompt reference.",
    },
    {
      id: AI_AUDIO_RESULT_INPUT_ID,
      name: AI_AUDIO_RESULT_INPUT_ID,
      type: "json",
      hidden: true,
      description: "Last generated audios shown on the canvas card.",
    },
    {
      id: AI_AUDIO_HISTORY_INPUT_ID,
      name: AI_AUDIO_HISTORY_INPUT_ID,
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
      id === "manual_audios" ||
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

export function readAiAudioResult(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[]
): WorkflowMediaValue[] {
  const fromInput = inputs.find(
    (input) => input.id === AI_AUDIO_RESULT_INPUT_ID
  );
  const fromInputAudios = parseWorkflowMediaValues(fromInput?.value);
  if (fromInputAudios.length > 0) {
    return fromInputAudios;
  }

  const fromOutput = outputs?.find((output) => output.id === AI_AUDIO_OUTPUT_ID);
  return parseWorkflowMediaValues(fromOutput?.value);
}

export function readAiAudioResultHistory(
  inputs: readonly WorkflowParameter[]
): AiAudioResultHistory {
  const raw = inputs.find(
    (input) => input.id === AI_AUDIO_HISTORY_INPUT_ID
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
        (entry): entry is AiAudioResultHistoryItem =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as AiAudioResultHistoryItem).id === "string" &&
          Array.isArray((entry as AiAudioResultHistoryItem).audios) &&
          typeof (entry as AiAudioResultHistoryItem).createdAt === "string"
      )
      .map((entry) => {
        const item = entry as AiAudioResultHistoryItem & { prompt?: string };
        return {
          ...item,
          prompt: typeof item.prompt === "string" ? item.prompt : "",
        };
      })
    : [];

  const items = splitHistoryMediaRows({
    items: rawItems,
    getMedia: (item) => item.audios,
    withMedia: (item, audios) => ({ ...item, audios }),
  });

  return {
    items,
    selectedId:
      typeof record.selectedId === "string" ? record.selectedId : null,
  };
}

export function withAiAudioResult(
  current: WorkflowNodeType,
  audios: readonly MediaReference[],
  extras?: {
    readonly inputs?: readonly WorkflowParameter[];
  }
): Partial<WorkflowNodeType> {
  const baseInputs = extras?.inputs ?? current.inputs;
  let inputs = upsertInputValue(
    baseInputs,
    AI_AUDIO_RESULT_INPUT_ID,
    [...audios],
    "json"
  );

  const history = readAiAudioResultHistory(inputs);
  if (history.selectedId) {
    const nextHistory: AiAudioResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId ? { ...item, audios: [...audios] } : item
      ),
    };
    inputs = upsertInputValue(
      inputs,
      AI_AUDIO_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const outputs = current.outputs.map((output) =>
    output.id === AI_AUDIO_OUTPUT_ID
      ? ({ ...output, value: [...audios] } as WorkflowParameter)
      : output
  );

  return { inputs, outputs };
}

/**
 * Card preview while cloud persist is uploading. Does not append history —
 * final success path writes the history entry.
 */
export function withAiAudioStagingPreview(
  current: WorkflowNodeType,
  audios: readonly WorkflowMediaValue[]
): Partial<WorkflowNodeType> {
  const inputs = upsertInputValue(
    current.inputs,
    AI_AUDIO_RESULT_INPUT_ID,
    [...audios],
    "json"
  );
  const outputs = current.outputs.map((output) =>
    output.id === AI_AUDIO_OUTPUT_ID
      ? ({ ...output, value: [...audios] } as WorkflowParameter)
      : output
  );
  return { inputs, outputs };
}

export function readAiAudioCardDisplay(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): GenerativeCardCoverRead<WorkflowMediaValue> {
  const manual = parseWorkflowMediaValues(
    inputs.find((input) => input.id === "manual_audios")?.value
  );
  if (manual.length > 0) {
      return {
        coverMedia: manual,
        isBusy: false,
        hasCover: hasDisplayableWorkflowMedia(manual),
        cardPhase: null,
      };
  }

  const history = readAiAudioResultHistory(inputs);
  if (history.selectedId) {
    return readGenerativeCardCoverFromHistory(history, (item) => item.audios, {
      metadata,
      isModalityGenerating: isAiAudioGenerating(metadata),
    });
  }

  const fallback = readAiAudioResult(inputs, outputs);
  const cardPhase = resolveGenerativeCardPhase(
    metadata,
    fallback,
    isAiAudioGenerating(metadata)
  );
  return {
    coverMedia: fallback,
    isBusy:
      (cardPhase !== null && isGenerativeCardBusyPhase(cardPhase)) ||
      isAiAudioGenerating(metadata) ||
      hasGeneratingResource(fallback),
    hasCover: hasDisplayableWorkflowMedia(fallback),
    cardPhase,
  };
}

export function readAiAudioCardAudios(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[],
  metadata?: Record<string, string>
): WorkflowMediaValue[] {
  return [...readAiAudioCardDisplay(inputs, outputs, metadata).coverMedia];
}

export function withAiAudioManualUpload(
  current: WorkflowNodeType,
  audios: readonly MediaReference[]
): Partial<WorkflowNodeType> {
  let inputs = upsertInputValue(
    current.inputs,
    "manual_audios",
    [...audios],
    "json"
  );
  inputs = upsertInputValue(inputs, AI_AUDIO_RESULT_INPUT_ID, [...audios], "json");

  const outputs = current.outputs.map((output) =>
    output.id === AI_AUDIO_OUTPUT_ID
      ? ({ ...output, value: [...audios] } as WorkflowParameter)
      : output
  );

  const metadata =
    audios.length > 0
      ? withGenerativeManualContentMode(current.metadata)
      : withGenerativeGeneratedContentMode(current.metadata);

  return { inputs, outputs, metadata };
}

export function appendAiAudioGeneratedHistoryItems(
  current: WorkflowNodeType,
  audios: readonly MediaReference[],
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
  if (audios.length === 0) return {};

  const history = readAiAudioResultHistory(current.inputs);
  const pendingIndex = meta?.jobId
    ? history.items.findIndex((item) => item.jobId === meta.jobId)
    : -1;
  if (pendingIndex >= 0) {
    const pending = history.items[pendingIndex]!;
    const nextItems = history.items.map((item, index) =>
      index === pendingIndex
        ? { ...item, audios: [audios[0]!], jobId: undefined }
        : item
    );
    const nextHistory: AiAudioResultHistory = {
      items: nextItems,
      selectedId: pending.id,
    };
    let nextInputs = upsertInputValue(
      current.inputs,
      AI_AUDIO_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
    nextInputs = upsertInputValue(nextInputs, "manual_audios", [], "json");
    const result = withAiAudioResult(current, [audios[0]!], {
      inputs: nextInputs,
    });
    return {
      ...result,
      metadata: withGenerativeGeneratedContentMode(current.metadata),
    };
  }
  const createdAt = new Date().toISOString();
  const batchId = Date.now();
  const newItems: AiAudioResultHistoryItem[] = audios.map((audio, index) => ({
    id: `gen-${batchId}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    audios: [audio],
    prompt: meta?.prompt ?? "",
    params: meta?.params,
    platformModelId: meta?.platformModelId,
    aiInterfaceId: meta?.aiInterfaceId,
    providerModelId: meta?.providerModelId,
    modelDisplayName: meta?.modelDisplayName,
    createdAt,
  }));
  const primary = newItems[0]!;

  const nextHistory: AiAudioResultHistory = {
    items: [...newItems, ...history.items].slice(0, AI_AUDIO_MAX_HISTORY_ITEMS),
    selectedId: primary.id,
  };

  let inputs = upsertInputValue(
    current.inputs,
    AI_AUDIO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  inputs = upsertInputValue(inputs, "manual_audios", [], "json");

  const result = withAiAudioResult(current, [audios[0]!], { inputs });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function readAiAudioGeneratingJobId(
  inputs: readonly WorkflowParameter[]
): string | undefined {
  const history = readAiAudioResultHistory(inputs);
  for (const item of history.items) {
    if (item.jobId && hasGeneratingResource(item.audios)) {
      return item.jobId;
    }
  }
  return undefined;
}

export function withAiAudioGeneratingHistory(
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
  const history = readAiAudioResultHistory(current.inputs);
  const item: AiAudioResultHistoryItem = {
    id: `gen-${Date.now()}-0-${Math.random().toString(36).slice(2, 8)}`,
    audios: [],
    prompt: params.prompt,
    params: params.params,
    platformModelId: params.platformModelId,
    aiInterfaceId: params.aiInterfaceId,
    providerModelId: params.providerModelId,
    modelDisplayName: params.modelDisplayName,
    createdAt: new Date().toISOString(),
    jobId: params.jobId,
  };
  const nextHistory: AiAudioResultHistory = {
    items: [item, ...history.items].slice(0, AI_AUDIO_MAX_HISTORY_ITEMS),
    selectedId: item.id,
  };
  const inputs = upsertInputValue(
    current.inputs,
    AI_AUDIO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  return {
    ...withAiAudioResult(current, [], { inputs }),
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function withAiAudioGeneratingHistoryFailed(
  current: WorkflowNodeType,
  jobId?: string | null
): Partial<WorkflowNodeType> {
  const history = readAiAudioResultHistory(current.inputs);
  const nextItems = history.items.map((item) => {
    const matchesJob = Boolean(jobId && item.jobId === jobId);
    if (!matchesJob && !hasGeneratingResource(item.audios)) {
      return item;
    }
    if (jobId && item.jobId && item.jobId !== jobId) {
      return item;
    }
    return {
      ...item,
      audios: item.audios.map((audio) =>
        isResourceIdReference(audio)
          ? {
              resourceId: audio.resourceId,
              mimeType: audio.mimeType,
              contentSha256: audio.contentSha256,
              failed: true,
            }
          : audio
      ),
    };
  });
  const selected =
    nextItems.find((item) => item.id === history.selectedId) ?? nextItems[0];
  const nextHistory: AiAudioResultHistory = {
    items: nextItems,
    selectedId: selected?.id ?? null,
  };
  const inputs = upsertInputValue(
    current.inputs,
    AI_AUDIO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  return withAiAudioResult(current, selected?.audios ?? [], { inputs });
}

export function withAiAudioResourcesMarkedFailed(
  current: WorkflowNodeType,
  resourceIds: readonly string[]
): Partial<WorkflowNodeType> {
  const ids = new Set(resourceIds);
  if (ids.size === 0) {
    return {};
  }

  const history = readAiAudioResultHistory(current.inputs);
  const nextHistory: AiAudioResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      audios: item.audios.map((audio) =>
        isResourceIdReference(audio) && ids.has(audio.resourceId)
          ? markResourceRefFailed(audio)
          : audio
      ),
    })),
  };

  const inputs = upsertInputValue(
    current.inputs,
    AI_AUDIO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const resultAudios = readAiAudioResult(inputs, current.outputs).map((audio) =>
    isResourceIdReference(audio) && ids.has(audio.resourceId)
      ? markResourceRefFailed(audio)
      : audio
  );
  return withAiAudioResult(current, resultAudios, { inputs });
}

export function withAiAudioResourceGeneratingCleared(
  current: WorkflowNodeType,
  resourceIds: readonly string[]
): Partial<WorkflowNodeType> {
  const ids = new Set(resourceIds);
  if (ids.size === 0) {
    return {};
  }

  const history = readAiAudioResultHistory(current.inputs);
  const nextHistory: AiAudioResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      audios: item.audios.map((audio) => {
        if (
          isResourceIdReference(audio) &&
          audio.generating &&
          ids.has(audio.resourceId)
        ) {
          return stripGeneratingFlag(audio);
        }
        return audio;
      }),
    })),
  };

  const inputs = upsertInputValue(
    current.inputs,
    AI_AUDIO_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );
  const resultAudios = readAiAudioResult(inputs, current.outputs).map((audio) => {
    if (
      isResourceIdReference(audio) &&
      audio.generating &&
      ids.has(audio.resourceId)
    ) {
      return stripGeneratingFlag(audio);
    }
    return audio;
  });
  return withAiAudioResult(current, resultAudios, { inputs });
}

export function withAiAudioResourceKinds(
  current: WorkflowNodeType,
  kindsById: ReadonlyMap<string, MediaResourceKind>
): Partial<WorkflowNodeType> {
  if (kindsById.size === 0) {
    return {};
  }

  const history = readAiAudioResultHistory(current.inputs);
  const nextHistory: AiAudioResultHistory = {
    selectedId: history.selectedId,
    items: history.items.map((item) => ({
      ...item,
      audios: mapMediaResourceKinds(item.audios, kindsById),
    })),
  };
  const historyChanged = nextHistory.items.some(
    (item, index) => item.audios !== history.items[index]!.audios
  );

  let inputs = current.inputs;
  if (historyChanged) {
    inputs = upsertInputValue(
      current.inputs,
      AI_AUDIO_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const resultAudios = readAiAudioResult(inputs, current.outputs);
  const nextResult = mapMediaResourceKinds(resultAudios, kindsById);
  if (!historyChanged && nextResult === resultAudios) {
    return {};
  }
  return withAiAudioResult(current, [...nextResult], { inputs });
}

export function withAiAudioHistorySelection(
  current: WorkflowNodeType,
  selectedId: string,
  options?: {
    readonly models?: readonly OrgAudioModelOption[];
  }
): GenerativeHistorySelectionResult {
  const history = readAiAudioResultHistory(current.inputs);
  const selected = history.items.find((entry) => entry.id === selectedId);
  if (!selected) return {};

  const settings = options?.models
    ? applyHistoryItemSettingsToNode({
        current,
        modality: "audio",
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

  const result = withAiAudioResult(working, selected.audios.slice(0, 1), {
    inputs: upsertInputValue(
      nextInputs,
      AI_AUDIO_HISTORY_INPUT_ID,
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

export function isAiAudioGenerating(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[AI_AUDIO_GENERATING_META_KEY] === "1";
}

export function withAiAudioGeneratingFlag(
  metadata: Record<string, string> | undefined,
  generating: boolean
): Record<string, string> | undefined {
  if (generating) {
    return { ...(metadata ?? {}), [AI_AUDIO_GENERATING_META_KEY]: "1" };
  }

  if (!metadata || !(AI_AUDIO_GENERATING_META_KEY in metadata)) {
    return metadata;
  }

  const next = { ...metadata };
  delete next[AI_AUDIO_GENERATING_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function canGenerateAiAudio(params: {
  readonly prompt: string;
  readonly blocksGenerativeMedia?: boolean;
}): boolean {
  if (params.blocksGenerativeMedia) return false;
  return params.prompt.trim().length > 0;
}

export function pickDefaultAudioModelCanonicalId(
  models: readonly {
    readonly canonicalId: string;
    readonly selectable: boolean;
  }[]
): string | undefined {
  const selectable = models.filter((entry) => entry.selectable);
  return selectable[0]?.canonicalId;
}

export function isAiAudioOutputHandle(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_AUDIO_NODE_TYPE && handleId === AI_AUDIO_OUTPUT_ID;
}

export function resolveAiAudioModelRules(
  data: WorkflowNodeType,
  models: readonly {
    readonly canonicalId: string;
    readonly parameterRules: AudioModelParameterRules;
  }[]
): AudioModelParameterRules {
  const modelId = data.inputs.find((input) => input.id === "model")?.value;
  const canonicalId = typeof modelId === "string" ? modelId : "";
  const model = models.find((entry) => entry.canonicalId === canonicalId);
  if (model) {
    return normalizeAudioModelParameterRules(model.parameterRules);
  }
  return normalizeAudioModelParameterRules(
    model?.parameterRules ?? DEFAULT_AUDIO_MODEL_PARAMETER_RULES
  );
}
