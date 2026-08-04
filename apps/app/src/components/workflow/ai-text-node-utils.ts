import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  DEEPSEEK_V4_FLASH_CANONICAL_ID,
  normalizeTextModelParameterRules,
  type AiTextResultHistory,
  type AiTextResultHistoryItem,
  type TextModelParameterRules,
} from "@dafthunk/types";

import type { NodeType, WorkflowNodeType, WorkflowParameter } from "./workflow-types";
import {
  withGenerativeGeneratedContentMode,
  withGenerativeManualContentMode,
} from "./generative-card-mode-utils";

export const AI_TEXT_RESULT_INPUT_ID = "result" as const;
export const AI_TEXT_RESULT_HISTORY_INPUT_ID = "result_history" as const;
export const AI_TEXT_OUTPUT_ID = "text" as const;
export const AI_TEXT_KEYWORDS_HANDLE_ID = "keywords" as const;

/** Hard ceiling for output length — Admin must not configure above this. */
export const AI_TEXT_HARD_OUTPUT_MAX_CHARS = 32_000;

/** Canvas card size — matches reference site text cards. */
export const AI_TEXT_CARD_WIDTH_PX = 360;
export const AI_TEXT_CARD_HEIGHT_PX = 196;

/** Bottom editor panel — screen-fixed visual size (inverse-scaled vs canvas zoom). */
export const AI_TEXT_PANEL_WIDTH_PX = 640;
export const AI_TEXT_PANEL_HEIGHT_PX = 336;
export const AI_TEXT_PANEL_PROMPT_MIN_HEIGHT_PX = 220;

export const AI_TEXT_GENERATING_META_KEY = "aiTextGenerating" as const;

/** Only these generative nodes may connect into AI Text keywords. */
export const AI_TEXT_ALLOWED_REFERENCE_NODE_TYPES = [
  AI_TEXT_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
] as const;

export type AiTextAllowedReferenceNodeType =
  (typeof AI_TEXT_ALLOWED_REFERENCE_NODE_TYPES)[number];

export function isAiTextAllowedReferenceNodeType(
  nodeType: string | undefined
): nodeType is AiTextAllowedReferenceNodeType {
  return (
    nodeType === AI_TEXT_NODE_TYPE ||
    nodeType === AI_IMAGE_NODE_TYPE ||
    nodeType === AI_VIDEO_NODE_TYPE
  );
}

export function mergeAiTextNodeCatalogInputs(
  nodeType: string | undefined,
  inputs: readonly WorkflowParameter[],
  catalog: NodeType | undefined
): WorkflowParameter[] {
  if (nodeType !== AI_TEXT_NODE_TYPE || !catalog) {
    return [...inputs];
  }

  const merged = [...inputs];
  for (const templateInput of catalog.inputs) {
    const id = templateInput.name;
    if (merged.some((input) => input.id === id)) {
      continue;
    }
    merged.push({ ...templateInput, id });
  }
  return merged;
}

export function pickDefaultTextModelCanonicalId(
  models: readonly {
    readonly canonicalId: string;
    readonly selectable: boolean;
  }[]
): string | undefined {
  const selectable = models.filter((entry) => entry.selectable);
  if (selectable.length === 0) {
    return undefined;
  }

  return (
    selectable.find(
      (entry) => entry.canonicalId === DEEPSEEK_V4_FLASH_CANONICAL_ID
    )?.canonicalId ?? selectable[0]?.canonicalId
  );
}

/**
 * Persistable card text lives on input `result` (workflow save keeps input values).
 * Mirror onto output `text` for in-session edges / preview.
 * When a history entry is selected, keep that entry's text in sync with result.
 */
export function withAiTextResult(
  current: WorkflowNodeType,
  text: string,
  extras?: {
    readonly inputs?: readonly WorkflowParameter[];
  }
): Partial<WorkflowNodeType> {
  const baseInputs = extras?.inputs ?? current.inputs;
  let inputs = upsertInputValue(baseInputs, AI_TEXT_RESULT_INPUT_ID, text);

  const history = readAiTextResultHistory(inputs);
  if (history.selectedId) {
    const nextHistory: AiTextResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId ? { ...item, text } : item
      ),
    };
    inputs = upsertInputValue(
      inputs,
      AI_TEXT_RESULT_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  const outputs = current.outputs.map((output) =>
    output.id === AI_TEXT_OUTPUT_ID
      ? ({ ...output, value: text } as WorkflowParameter)
      : output
  );

  return { inputs, outputs };
}

/** Live stream preview: update card text without rewriting history entries. */
export function withAiTextStreamingPreview(
  current: WorkflowNodeType,
  text: string
): Partial<WorkflowNodeType> {
  const inputs = upsertInputValue(current.inputs, AI_TEXT_RESULT_INPUT_ID, text);
  const outputs = current.outputs.map((output) =>
    output.id === AI_TEXT_OUTPUT_ID
      ? ({ ...output, value: text } as WorkflowParameter)
      : output
  );
  return { inputs, outputs };
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

export function readAiTextResult(
  inputs: readonly WorkflowParameter[],
  outputs?: readonly WorkflowParameter[]
): string | undefined {
  const fromInput = inputs.find((input) => input.id === AI_TEXT_RESULT_INPUT_ID);
  if (typeof fromInput?.value === "string") {
    return fromInput.value;
  }

  const fromOutput = outputs?.find((output) => output.id === AI_TEXT_OUTPUT_ID);
  return typeof fromOutput?.value === "string" ? fromOutput.value : undefined;
}

/** Text usable as downstream image/video prompt from an AI text node. */
export function readAiTextPromptSource(data: WorkflowNodeType): string {
  const fromResult = readAiTextResult(data.inputs, data.outputs);
  if (typeof fromResult === "string" && fromResult.trim()) {
    return fromResult.trim();
  }

  const promptInput = data.inputs.find((input) => input.id === "prompt");
  if (typeof promptInput?.value === "string" && promptInput.value.trim()) {
    return promptInput.value.trim();
  }

  const history = readAiTextResultHistory(data.inputs);
  const selected = history.selectedId
    ? history.items.find((item) => item.id === history.selectedId)
    : undefined;
  if (selected?.text.trim()) {
    return selected.text.trim();
  }

  return "";
}

export function readAiTextResultHistory(
  inputs: readonly WorkflowParameter[]
): AiTextResultHistory {
  const raw = inputs.find(
    (input) => input.id === AI_TEXT_RESULT_HISTORY_INPUT_ID
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
        (entry): entry is AiTextResultHistoryItem =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as AiTextResultHistoryItem).id === "string" &&
          typeof (entry as AiTextResultHistoryItem).text === "string"
      )
    : [];

  return {
    items,
    selectedId:
      typeof record.selectedId === "string" ? record.selectedId : null,
  };
}

export function withAiTextManualResult(
  current: WorkflowNodeType,
  text: string
): Partial<WorkflowNodeType> {
  const withResult = withAiTextResult(current, text);
  const metadata = text.trim()
    ? withGenerativeManualContentMode(current.metadata)
    : withGenerativeGeneratedContentMode(current.metadata);

  return { ...withResult, metadata };
}

/** Edit current text while keeping existing AI history / content mode intact. */
export function withAiTextEditedResult(
  current: WorkflowNodeType,
  text: string
): Partial<WorkflowNodeType> {
  return withAiTextResult(current, text);
}

export function hasAiTextGeneratedHistory(
  inputs: readonly WorkflowParameter[]
): boolean {
  return readAiTextResultHistory(inputs).items.length > 0;
}

export function withAiTextGeneratedResult(
  current: WorkflowNodeType,
  text: string,
  meta?: {
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
  }
): Partial<WorkflowNodeType> {
  const history = readAiTextResultHistory(current.inputs);
  const item: AiTextResultHistoryItem = {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    platformModelId: meta?.platformModelId,
    aiInterfaceId: meta?.aiInterfaceId,
    providerModelId: meta?.providerModelId,
    createdAt: new Date().toISOString(),
  };
  const nextHistory: AiTextResultHistory = {
    items: [item, ...history.items].slice(0, 30),
    selectedId: item.id,
  };

  const withResult = withAiTextResult(current, text, {
    inputs: upsertInputValue(
      current.inputs,
      AI_TEXT_RESULT_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    ),
  });
  return {
    ...withResult,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

/** Mark history selection; caller should then commit item text via the text buffer. */
export function withAiTextHistorySelectedId(
  current: WorkflowNodeType,
  selectedId: string
): Partial<WorkflowNodeType> {
  const history = readAiTextResultHistory(current.inputs);
  if (!history.items.some((entry) => entry.id === selectedId)) {
    return {};
  }

  return {
    inputs: upsertInputValue(
      current.inputs,
      AI_TEXT_RESULT_HISTORY_INPUT_ID,
      { items: history.items, selectedId },
      "json"
    ),
  };
}

/** @deprecated Prefer buffer.commit after withAiTextHistorySelectedId. */
export function withAiTextHistorySelection(
  current: WorkflowNodeType,
  selectedId: string
): Partial<WorkflowNodeType> {
  const history = readAiTextResultHistory(current.inputs);
  const selected = history.items.find((entry) => entry.id === selectedId);
  if (!selected) return {};

  const result = withAiTextResult(current, selected.text, {
    inputs: upsertInputValue(
      current.inputs,
      AI_TEXT_RESULT_HISTORY_INPUT_ID,
      { items: history.items, selectedId },
      "json"
    ),
  });
  return {
    ...result,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function isAiTextGenerating(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[AI_TEXT_GENERATING_META_KEY] === "1";
}

export function withAiTextGeneratingFlag(
  metadata: Record<string, string> | undefined,
  generating: boolean
): Record<string, string> | undefined {
  if (generating) {
    return { ...(metadata ?? {}), [AI_TEXT_GENERATING_META_KEY]: "1" };
  }

  if (!metadata || !(AI_TEXT_GENERATING_META_KEY in metadata)) {
    return metadata;
  }

  const next = { ...metadata };
  delete next[AI_TEXT_GENERATING_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

export type AiTextReferenceKind = "text" | "image" | "video";

export interface AiTextReferenceCounts {
  readonly text: number;
  readonly image: number;
  readonly video: number;
}

export function classifyReferenceFromNodeType(
  nodeType: string | undefined
): AiTextReferenceKind | null {
  if (nodeType === AI_TEXT_NODE_TYPE) return "text";
  if (nodeType === AI_IMAGE_NODE_TYPE) return "image";
  if (nodeType === AI_VIDEO_NODE_TYPE) return "video";
  return null;
}

/** @deprecated Prefer classifyReferenceFromNodeType for AI Text refs. */
export function classifyReferenceOutputType(
  type: string | undefined
): AiTextReferenceKind | "other" {
  if (type === "string") return "text";
  if (type === "image") return "image";
  if (type === "video") return "video";
  return "other";
}

export function emptyAiTextReferenceCounts(): AiTextReferenceCounts {
  return { text: 0, image: 0, video: 0 };
}

export function referencesFitModelLimits(
  counts: AiTextReferenceCounts,
  rules: TextModelParameterRules
): boolean {
  const normalized = normalizeTextModelParameterRules(rules);
  return (
    counts.text <= normalized.maxTextReferences &&
    counts.image <= normalized.maxImageReferences &&
    counts.video <= normalized.maxVideoReferences
  );
}

export function probeVideoFileDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("invalid_duration"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("probe_failed"));
    };
    video.src = url;
  });
}

export function probeVideoUrlDurationSeconds(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("invalid_duration"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => reject(new Error("probe_failed"));
    video.src = url;
  });
}
