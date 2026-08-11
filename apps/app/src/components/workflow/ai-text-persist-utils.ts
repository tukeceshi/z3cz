import {
  AI_TEXT_NODE_TYPE,
  buildAiTextExcerpt,
  type AiTextResultHistory,
  type AiTextResultHistoryItem,
  type ResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import {
  getResourceIdFromValue,
  isResourceIdReference,
} from "@dafthunk/types";

import {
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_RESULT_HISTORY_INPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  readAiTextResultHistory,
} from "./ai-text-node-utils";
import {
  withGenerativeGeneratedContentMode,
  withGenerativeManualContentMode,
} from "./generative-card-mode-utils";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export function readAiTextResultReference(
  inputs: readonly WorkflowParameter[]
): WorkflowMediaValue | undefined {
  const value = inputs.find((input) => input.id === AI_TEXT_RESULT_INPUT_ID)
    ?.value;
  if (
    value &&
    typeof value === "object" &&
    ("resourceId" in value || "kind" in value)
  ) {
    return value as WorkflowMediaValue;
  }
  return undefined;
}

export function readAiTextResultContentSha256(
  inputs: readonly WorkflowParameter[]
): string | undefined {
  const ref = readAiTextResultReference(inputs);
  if (ref && isResourceIdReference(ref)) {
    return ref.contentSha256;
  }
  return undefined;
}

/** Local preview excerpt — never persisted in workflow JSON. */
export function readAiTextPreviewExcerpt(text: string): string {
  return buildAiTextExcerpt(text);
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

export interface AiTextStagedResultPatch {
  readonly reference: WorkflowMediaValue;
  readonly contentSha256: string;
  readonly sessionText: string;
}

/** Persistable result: local/resource ref on input; full text mirrored on output for session edges. */
export function withAiTextStagedResult(
  current: WorkflowNodeType,
  staged: AiTextStagedResultPatch,
  extras?: { readonly inputs?: readonly WorkflowParameter[] }
): Partial<WorkflowNodeType> {
  const baseInputs = extras?.inputs ?? current.inputs;
  const reference = isResourceIdReference(staged.reference)
    ? { ...staged.reference, contentSha256: staged.contentSha256 }
    : staged.reference;
  const inputs = upsertInputValue(
    baseInputs,
    AI_TEXT_RESULT_INPUT_ID,
    reference,
    "json"
  );

  const outputs = current.outputs.map((output) =>
    output.id === AI_TEXT_OUTPUT_ID
      ? ({ ...output, value: staged.sessionText } as WorkflowParameter)
      : output
  );

  return { inputs, outputs };
}

export function withAiTextStagedGeneratedResult(
  current: WorkflowNodeType,
  staged: AiTextStagedResultPatch,
  meta?: {
    readonly platformModelId?: string;
    readonly aiInterfaceId?: string;
    readonly providerModelId?: string;
    readonly modelDisplayName?: string;
  }
): Partial<WorkflowNodeType> {
  const history = readAiTextResultHistory(current.inputs);
  const resourceId = getResourceIdFromValue(staged.reference);
  const item: AiTextResultHistoryItem = {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...(resourceId ? { resourceId } : {}),
    contentSha256: staged.contentSha256,
    platformModelId: meta?.platformModelId,
    aiInterfaceId: meta?.aiInterfaceId,
    providerModelId: meta?.providerModelId,
    modelDisplayName: meta?.modelDisplayName,
    createdAt: new Date().toISOString(),
  };
  const nextHistory: AiTextResultHistory = {
    items: [item, ...history.items].slice(0, 30),
    selectedId: item.id,
  };

  const inputsWithHistory = upsertInputValue(
    current.inputs,
    AI_TEXT_RESULT_HISTORY_INPUT_ID,
    nextHistory,
    "json"
  );

  return withAiTextStagedResult(current, staged, {
    inputs: inputsWithHistory,
  });
}

export function withAiTextStagedManualResult(
  current: WorkflowNodeType,
  staged: AiTextStagedResultPatch
): Partial<WorkflowNodeType> {
  const patch = withAiTextStagedResult(current, staged);
  return {
    ...patch,
    metadata: staged.sessionText.trim()
      ? withGenerativeManualContentMode(current.metadata)
      : withGenerativeGeneratedContentMode(current.metadata),
  };
}

export function withAiTextStagedEditedResult(
  current: WorkflowNodeType,
  staged: AiTextStagedResultPatch
): Partial<WorkflowNodeType> {
  const history = readAiTextResultHistory(current.inputs);
  let inputs = current.inputs;

  if (history.selectedId) {
    const resourceId = getResourceIdFromValue(staged.reference);
    const nextHistory: AiTextResultHistory = {
      selectedId: history.selectedId,
      items: history.items.map((item) =>
        item.id === history.selectedId
          ? {
              ...item,
              ...(resourceId ? { resourceId } : {}),
              contentSha256: staged.contentSha256,
              text: undefined,
              excerpt: undefined,
            }
          : item
      ),
    };
    inputs = upsertInputValue(
      inputs,
      AI_TEXT_RESULT_HISTORY_INPUT_ID,
      nextHistory,
      "json"
    );
  }

  return withAiTextStagedResult(current, staged, { inputs });
}

export function withAiTextStagedHistorySelection(
  current: WorkflowNodeType,
  selectedId: string,
  staged: AiTextStagedResultPatch
): Partial<WorkflowNodeType> {
  const history = readAiTextResultHistory(current.inputs);
  if (!history.items.some((entry) => entry.id === selectedId)) {
    return {};
  }

  const inputsWithSelection = upsertInputValue(
    current.inputs,
    AI_TEXT_RESULT_HISTORY_INPUT_ID,
    { items: history.items, selectedId },
    "json"
  );

  const patch = withAiTextStagedResult(current, staged, {
    inputs: inputsWithSelection,
  });

  return {
    ...patch,
    metadata: withGenerativeGeneratedContentMode(current.metadata),
  };
}

/** Strip inline bodies from ai-text nodes before workflow persist / WS patch. */
export function normalizeAiTextNodeDataForPersist(
  data: WorkflowNodeType
): WorkflowNodeType {
  if (data.nodeType !== AI_TEXT_NODE_TYPE) {
    return data;
  }

  const inputs = data.inputs.map((input) => {
    if (input.id === AI_TEXT_RESULT_INPUT_ID) {
      if (typeof input.value === "string") {
        return input;
      }
      return input;
    }
    if (input.id !== AI_TEXT_RESULT_HISTORY_INPUT_ID) {
      return input;
    }
    const history = readAiTextResultHistory(data.inputs);
    const items = history.items.map((item) => {
      const { text: _text, excerpt: _excerpt, ...rest } = item;
      return rest;
    });
    return {
      ...input,
      value: { items, selectedId: history.selectedId },
    };
  });

  const outputs = data.outputs.map((output) =>
    output.id === AI_TEXT_OUTPUT_ID ? { ...output, value: undefined } : output
  );

  return { ...data, inputs, outputs };
}

export function buildResourceIdReference(params: {
  readonly resourceId: string;
  readonly contentSha256: string;
  readonly mimeType: string;
}): ResourceIdReference {
  return {
    resourceId: params.resourceId,
    contentSha256: params.contentSha256,
    mimeType: params.mimeType,
  };
}
