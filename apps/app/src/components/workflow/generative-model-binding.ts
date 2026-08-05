import type {
  UpstreamParamProfileField,
  WorkflowGenerativeDefaultEntry,
  WorkflowGenerativeDefaults,
  OrgAudioModelOption,
  OrgImageModelOption,
  OrgTextModelOption,
  OrgVideoModelOption,
} from "@dafthunk/types";
import {
  normalizeAudioModelParameterRules,
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
} from "@dafthunk/types";

import {
  readNodeGenerationParams,
  sanitizeCardGenerationParams,
} from "./generative-card-params";
import { buildDefaultAudioGenerationParams } from "./ai-audio-params-popover";
import { buildDefaultImageGenerationParams } from "./ai-image-params-popover";
import { buildDefaultVideoGenerationParams } from "./ai-video-params-popover";
import { upsertNodeInputValues } from "./workflow-context";
import {
  readWorkflowGenerativeDefault,
  writeWorkflowGenerativeDefault,
} from "./generative-workflow-defaults";
import {
  persistGenerativeBindingWithParams,
  persistModelBindingToInputs,
  readModelSelectionRecord,
  resolveSelectedModelBinding,
  type GenerativeModelModality,
  type OrgModelBindingRef,
} from "./org-model-selection-utils";
import type { WorkflowNodeType } from "./workflow-types";

export interface GenerativeModelBindingHandlers<T extends OrgModelBindingRef> {
  readonly readGenerationFields?: (
    model: T
  ) => readonly UpstreamParamProfileField[];
  readonly buildDefaultParams?: (
    fields: readonly UpstreamParamProfileField[]
  ) => Record<string, unknown>;
  readonly onModelSelected?: (
    model: T,
    current: WorkflowNodeType
  ) => Partial<Pick<WorkflowNodeType, "inputs" | "metadata">> | void;
}

export interface ApplyModelBindingParams<T extends OrgModelBindingRef> {
  readonly model: T;
  readonly current: WorkflowNodeType;
  readonly modality: GenerativeModelModality;
  readonly updateWorkflowDefault: boolean;
  readonly generativeDefaults?: WorkflowGenerativeDefaults;
  readonly workflowDefaultEntry?: WorkflowGenerativeDefaultEntry;
  readonly handlers: GenerativeModelBindingHandlers<T>;
  readonly onGenerativeDefaultChange?: (
    defaults: WorkflowGenerativeDefaults
  ) => void;
}

function readModelId(data: WorkflowNodeType): string {
  const value = data.inputs?.find((input) => input.id === "model")?.value;
  return typeof value === "string" ? value : "";
}

function readInterfaceId(data: WorkflowNodeType): string {
  const value = data.inputs?.find((input) => input.id === "ai_interface_id")
    ?.value;
  return typeof value === "string" ? value : "";
}

function resolveMaterializeParams<T extends OrgModelBindingRef>(
  model: T,
  inputs: WorkflowNodeType["inputs"],
  handlers: GenerativeModelBindingHandlers<T>,
  defaultEntry: WorkflowGenerativeDefaultEntry | undefined
): Record<string, unknown> {
  const stored = readNodeGenerationParams(inputs);
  if (Object.keys(stored).length > 0) {
    return stored;
  }
  if (
    defaultEntry &&
    defaultEntry.canonicalId === model.canonicalId &&
    defaultEntry.interfaceId === model.interfaceId &&
    defaultEntry.params !== undefined
  ) {
    return { ...defaultEntry.params };
  }
  if (!handlers.readGenerationFields || !handlers.buildDefaultParams) {
    return {};
  }
  return handlers.buildDefaultParams(handlers.readGenerationFields(model));
}

/** Shared model binding apply path for manual pick, history, and auto-switch. */
export function applyModelBindingToNodeData<T extends OrgModelBindingRef>(
  params: ApplyModelBindingParams<T>
): Partial<WorkflowNodeType> {
  const { handlers, model, current } = params;
  const extras = handlers.onModelSelected?.(model, current);
  const defaultEntry =
    params.workflowDefaultEntry ??
    readWorkflowGenerativeDefault(params.generativeDefaults, params.modality);

  const nextInputs =
    extras?.inputs ??
    persistGenerativeBindingWithParams(
      current.inputs,
      {
        canonicalId: model.canonicalId,
        interfaceId: model.interfaceId,
      },
      handlers.readGenerationFields && handlers.buildDefaultParams
        ? sanitizeCardGenerationParams(
            handlers.readGenerationFields(model),
            resolveMaterializeParams(
              model,
              current.inputs,
              handlers,
              defaultEntry
            )
          )
        : {}
    );

  if (params.updateWorkflowDefault && params.onGenerativeDefaultChange) {
    const paramsEntry = readNodeGenerationParams(nextInputs);
    params.onGenerativeDefaultChange(
      writeWorkflowGenerativeDefault(params.generativeDefaults, params.modality, {
        canonicalId: model.canonicalId,
        interfaceId: model.interfaceId,
        params: paramsEntry,
      })
    );
  }

  return {
    inputs: nextInputs,
    ...(extras?.metadata
      ? {
          metadata: {
            ...(current.metadata ?? {}),
            ...extras.metadata,
          },
        }
      : {}),
  };
}

export interface ResolveModelForNewReferenceResult<
  T extends OrgModelBindingRef,
> {
  readonly canConnect: boolean;
  readonly modelToApply: T | undefined;
  readonly effectiveModel: T | undefined;
}

/** Pick a model for a new reference: node binding first, then list order. */
export function resolveModelForNewReference<T extends OrgModelBindingRef>(
  params: {
    readonly models: readonly T[];
    readonly targetNodeData: WorkflowNodeType;
    readonly modelFits: (model: T) => boolean;
  }
): ResolveModelForNewReferenceResult<T> {
  const nodeBinding = readModelSelectionRecord({
    modelId: readModelId(params.targetNodeData),
    interfaceId: readInterfaceId(params.targetNodeData),
  });

  const currentFromNode = nodeBinding
    ? resolveSelectedModelBinding(
        params.models,
        nodeBinding.canonicalId,
        nodeBinding.interfaceId
      )
    : undefined;

  if (currentFromNode?.selectable && params.modelFits(currentFromNode)) {
    return {
      canConnect: true,
      modelToApply: undefined,
      effectiveModel: currentFromNode,
    };
  }

  const found = params.models.find(
    (model) => model.selectable && params.modelFits(model)
  );
  if (!found) {
    return {
      canConnect: false,
      modelToApply: undefined,
      effectiveModel: undefined,
    };
  }

  const needsApply =
    !currentFromNode || currentFromNode.optionId !== found.optionId;

  return {
    canConnect: true,
    modelToApply: needsApply ? found : undefined,
    effectiveModel: found,
  };
}

export function generativeModelBindingHandlersForModality(
  modality: GenerativeModelModality
): GenerativeModelBindingHandlers<OrgModelBindingRef> {
  switch (modality) {
    case "text":
      return {
        onModelSelected: (model) => {
          const rules = normalizeTextModelParameterRules(
            (model as OrgTextModelOption).parameterRules
          );
          return {
            metadata: {
              refMaxText: String(rules.maxTextReferences),
              refMaxImage: String(rules.maxImageReferences),
              refMaxVideo: String(rules.maxVideoReferences),
            },
          };
        },
      };
    case "image":
      return {
        readGenerationFields: (model) =>
          normalizeImageModelParameterRules(
            (model as OrgImageModelOption).parameterRules
          ).generationFields,
        buildDefaultParams: buildDefaultImageGenerationParams,
        onModelSelected: (model, current) => {
          const rules = normalizeImageModelParameterRules(
            (model as OrgImageModelOption).parameterRules
          );
          const defaultParams = buildDefaultImageGenerationParams(
            rules.generationFields
          );
          return {
            inputs: upsertNodeInputValues(
              persistModelBindingToInputs(current.inputs, {
                canonicalId: model.canonicalId,
                interfaceId: model.interfaceId,
              }),
              { params: defaultParams },
              { params: "json" }
            ),
          };
        },
      };
    case "video":
      return {
        readGenerationFields: (model) =>
          normalizeVideoModelParameterRules(
            (model as OrgVideoModelOption).parameterRules
          ).generationFields,
        buildDefaultParams: buildDefaultVideoGenerationParams,
        onModelSelected: (model, current) => {
          const rules = normalizeVideoModelParameterRules(
            (model as OrgVideoModelOption).parameterRules
          );
          const defaultParams = buildDefaultVideoGenerationParams(
            rules.generationFields
          );
          return {
            inputs: upsertNodeInputValues(
              persistModelBindingToInputs(current.inputs, {
                canonicalId: model.canonicalId,
                interfaceId: model.interfaceId,
              }),
              { params: defaultParams },
              { params: "json" }
            ),
          };
        },
      };
    case "audio":
      return {
        readGenerationFields: (model) =>
          normalizeAudioModelParameterRules(
            (model as OrgAudioModelOption).parameterRules
          ).generationFields,
        buildDefaultParams: buildDefaultAudioGenerationParams,
        onModelSelected: (model, current) => {
          const rules = normalizeAudioModelParameterRules(
            (model as OrgAudioModelOption).parameterRules
          );
          const defaultParams = buildDefaultAudioGenerationParams(
            rules.generationFields
          );
          return {
            inputs: upsertNodeInputValues(
              persistModelBindingToInputs(current.inputs, {
                canonicalId: model.canonicalId,
                interfaceId: model.interfaceId,
              }),
              { params: defaultParams },
              { params: "json" }
            ),
          };
        },
      };
    default:
      return {};
  }
}
