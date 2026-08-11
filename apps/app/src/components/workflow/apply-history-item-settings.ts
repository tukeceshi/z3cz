import type { UpstreamParamProfileField } from "@dafthunk/types";

import {
  persistNodeGenerationParams,
  readNodeGenerationParams,
  sanitizeCardGenerationParams,
} from "./generative-card-params";
import {
  generativeModelBindingHandlersForModality,
} from "./generative-model-binding";
import { generativeReferenceMetadataForModel } from "./generative-reference-metadata";
import {
  persistGenerativeBindingWithParams,
  readModelSelectionRecord,
  resolveHistoryModelBinding,
  resolveSelectedModelBinding,
  type GenerativeModelModality,
  type HistoryModelBinding,
  type OrgModelBindingRef,
} from "./org-model-selection-utils";
import type { WorkflowNodeType } from "./workflow-types";

export interface ApplyHistoryItemSettingsResult {
  readonly patch: Partial<WorkflowNodeType>;
  readonly modelUnavailable: boolean;
}

export interface GenerativeHistorySelectionResult
  extends Partial<WorkflowNodeType> {
  readonly modelUnavailable?: boolean;
}

function readBindingFromNode(
  data: WorkflowNodeType
): ReturnType<typeof readModelSelectionRecord> {
  const modelValue = data.inputs?.find((input) => input.id === "model")?.value;
  const interfaceValue = data.inputs?.find(
    (input) => input.id === "ai_interface_id"
  )?.value;
  return readModelSelectionRecord({
    modelId: typeof modelValue === "string" ? modelValue : "",
    interfaceId: typeof interfaceValue === "string" ? interfaceValue : "",
  });
}

function sanitizeHistoryParams<T extends OrgModelBindingRef>(
  model: T,
  historyParams: Readonly<Record<string, unknown>> | undefined,
  readGenerationFields:
    | ((model: T) => readonly UpstreamParamProfileField[])
    | undefined,
  fallbackInputs: WorkflowNodeType["inputs"]
): Record<string, unknown> {
  if (historyParams === undefined) {
    return readNodeGenerationParams(fallbackInputs);
  }
  if (!readGenerationFields) {
    return { ...historyParams };
  }
  const fields = readGenerationFields(model);
  if (fields.length === 0) {
    return { ...historyParams };
  }
  return sanitizeCardGenerationParams(fields, historyParams);
}

/** Resolve history model against live catalog and write binding + sanitized params. */
export function applyHistoryItemSettingsToNode<T extends OrgModelBindingRef>(
  params: {
    readonly current: WorkflowNodeType;
    readonly modality: GenerativeModelModality;
    readonly models: readonly T[];
    readonly historyBinding: HistoryModelBinding;
    readonly historyParams?: Readonly<Record<string, unknown>>;
  }
): ApplyHistoryItemSettingsResult {
  const handlers = generativeModelBindingHandlersForModality(params.modality);
  const historyBindingRef = resolveHistoryModelBinding(params.historyBinding);
  let modelUnavailable = false;

  let resolvedModel: T | undefined;
  if (historyBindingRef) {
    resolvedModel = resolveSelectedModelBinding(
      params.models,
      historyBindingRef.canonicalId,
      historyBindingRef.interfaceId
    );
    if (!resolvedModel?.selectable) {
      modelUnavailable = true;
      resolvedModel = undefined;
    }
  }

  const paramModel =
    resolvedModel ??
    (() => {
      const currentBinding = readBindingFromNode(params.current);
      if (!currentBinding) {
        return undefined;
      }
      return resolveSelectedModelBinding(
        params.models,
        currentBinding.canonicalId,
        currentBinding.interfaceId
      );
    })();

  if (!paramModel) {
    return { patch: {}, modelUnavailable };
  }

  const sanitizedParams = sanitizeHistoryParams(
    paramModel,
    params.historyParams,
    handlers.readGenerationFields as
      | ((model: T) => readonly UpstreamParamProfileField[])
      | undefined,
    params.current.inputs
  );

  if (!resolvedModel) {
    return {
      patch: {
        inputs: persistNodeGenerationParams(
          sanitizedParams,
          params.current.inputs
        ),
      },
      modelUnavailable,
    };
  }

  const referenceMetadata = generativeReferenceMetadataForModel(
    params.modality,
    resolvedModel
  );

  return {
    patch: {
      inputs: persistGenerativeBindingWithParams(
        params.current.inputs,
        {
          canonicalId: resolvedModel.canonicalId,
          interfaceId: resolvedModel.interfaceId,
        },
        sanitizedParams
      ),
      metadata: {
        ...(params.current.metadata ?? {}),
        ...(referenceMetadata ?? {}),
      },
    },
    modelUnavailable,
  };
}
