import {
  normalizeAudioModelParameterRules,
  normalizeImageModelParameterRules,
  normalizeVideoModelParameterRules,
  type AudioModelParameterRules,
  type ImageModelParameterRules,
  type UpstreamParamProfileField,
  type VideoModelParameterRules,
  type WorkflowGenerativeDefaults,
} from "@dafthunk/types";

import {
  readNodeGenerationParams,
  sanitizeCardGenerationParams,
} from "./generative-card-params";
import { paramRecordsEqual } from "./param-records-equal";
import {
  readWorkflowGenerativeDefault,
  writeWorkflowGenerativeDefault,
} from "./generative-workflow-defaults";
import {
  readModelSelectionRecord,
  type GenerativeModelModality,
  type ModelBindingRef,
  type OrgModelBindingRef,
} from "./org-model-selection-utils";
import { updateNodeInput } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface ParamCatalogModel extends OrgModelBindingRef {
  readonly parameterRules?: unknown;
}

export interface GenerativeParamModelCatalog {
  readonly image: readonly ParamCatalogModel[];
  readonly video: readonly ParamCatalogModel[];
  readonly audio: readonly ParamCatalogModel[];
}

export function mergeWorkflowParamDefaults(
  existing: Readonly<Record<string, unknown>> | undefined,
  incoming: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...incoming,
  };
}

/** Model template first; saved value used only when it fits the field. */
export function resolveParamsForNewNode(
  fields: readonly UpstreamParamProfileField[],
  saved: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> {
  if (fields.length === 0) {
    return {};
  }
  return sanitizeCardGenerationParams(fields, saved);
}

export function generationFieldsForModality(
  modality: GenerativeModelModality,
  model: ParamCatalogModel
): readonly UpstreamParamProfileField[] {
  switch (modality) {
    case "image":
      return normalizeImageModelParameterRules(
        model.parameterRules as ImageModelParameterRules
      ).generationFields;
    case "video":
      return normalizeVideoModelParameterRules(
        model.parameterRules as VideoModelParameterRules
      ).generationFields;
    case "audio":
      return normalizeAudioModelParameterRules(
        model.parameterRules as AudioModelParameterRules
      ).generationFields;
    default:
      return [];
  }
}

export function catalogModelsForModality(
  catalog: GenerativeParamModelCatalog | undefined,
  modality: GenerativeModelModality
): readonly ParamCatalogModel[] {
  if (!catalog) {
    return [];
  }
  switch (modality) {
    case "image":
      return catalog.image;
    case "video":
      return catalog.video;
    case "audio":
      return catalog.audio;
    default:
      return [];
  }
}

function readBindingFromInputs(
  inputs: readonly WorkflowParameter[]
): ModelBindingRef | undefined {
  const modelValue = inputs.find((input) => input.id === "model")?.value;
  const interfaceValue = inputs.find(
    (input) => input.id === "ai_interface_id"
  )?.value;
  const instanceValue = inputs.find(
    (input) => input.id === "model_instance_id"
  )?.value;
  return readModelSelectionRecord({
    modelId: typeof modelValue === "string" ? modelValue : "",
    interfaceId: typeof interfaceValue === "string" ? interfaceValue : "",
    instanceId: typeof instanceValue === "string" ? instanceValue : "",
  });
}

export interface GenerativeParamCommitContext {
  readonly next: Record<string, unknown>;
  readonly fields: readonly UpstreamParamProfileField[];
  readonly nodeId: string;
  readonly nodeInputs: WorkflowParameter[];
  readonly updateNodeData: (
    nodeId: string,
    data: Partial<WorkflowNodeType>
  ) => void;
  readonly modality: GenerativeModelModality;
  readonly generativeDefaults?: WorkflowGenerativeDefaults;
  readonly onGenerativeDefaultChange?: (
    defaults: WorkflowGenerativeDefaults
  ) => void;
}

export function commitNodeGenerationParams(
  params: Pick<
    GenerativeParamCommitContext,
    "next" | "fields" | "nodeId" | "nodeInputs" | "updateNodeData"
  >
): void {
  const sanitized = sanitizeCardGenerationParams(params.fields, params.next);
  const current = readNodeGenerationParams(params.nodeInputs);
  if (paramRecordsEqual(current, sanitized)) {
    return;
  }
  updateNodeInput(
    params.nodeId,
    "params",
    sanitized,
    params.nodeInputs,
    params.updateNodeData
  );
}

export function commitGenerativeDefaultParams(
  params: GenerativeParamCommitContext
): void {
  if (!params.onGenerativeDefaultChange) {
    return;
  }

  const sanitized = sanitizeCardGenerationParams(params.fields, params.next);
  const existing = readWorkflowGenerativeDefault(
    params.generativeDefaults,
    params.modality
  );
  const identity = existing ?? readBindingFromInputs(params.nodeInputs);
  if (!identity) {
    return;
  }

  params.onGenerativeDefaultChange(
    writeWorkflowGenerativeDefault(params.generativeDefaults, params.modality, {
      canonicalId: identity.canonicalId,
      interfaceId: identity.interfaceId,
      ...(identity.instanceId?.trim()
        ? { instanceId: identity.instanceId.trim() }
        : {}),
      params: mergeWorkflowParamDefaults(existing?.params, sanitized),
    })
  );
}

export function commitGenerativeParamWindow(
  params: GenerativeParamCommitContext
): void {
  commitNodeGenerationParams(params);
  commitGenerativeDefaultParams(params);
}
