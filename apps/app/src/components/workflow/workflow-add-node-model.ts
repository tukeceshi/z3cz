import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type AiGenerativeNodeType,
  type WorkflowGenerativeDefaults,
} from "@dafthunk/types";
import type { Connection } from "@xyflow/react";

import { generativeModalityForNodeType } from "./generative-workflow-defaults";
import {
  applyModelBindingToNodeData,
  generativeModelBindingHandlersForModality,
  resolveModelForNewReference,
} from "./generative-model-binding";
import { createProjectedModelFits } from "./generative-model-ref-fit";
import type { OrgModelBindingRef } from "./org-model-selection-utils";
import {
  fetchOrgAudioModels,
  fetchOrgImageModels,
  fetchOrgTextModels,
  fetchOrgVideoModels,
} from "@/services/platform-ai-model-service";

import type { WorkflowNodeType } from "./workflow-types";

export interface ResolveAddNodeReferenceModelResult {
  readonly canConnect: boolean;
  readonly nodeData: WorkflowNodeType;
}

async function fetchModelsForType(
  orgId: string,
  targetType: AiGenerativeNodeType
): Promise<readonly OrgModelBindingRef[]> {
  switch (targetType) {
    case AI_TEXT_NODE_TYPE:
      return (await fetchOrgTextModels(orgId)).models;
    case AI_IMAGE_NODE_TYPE:
      return (await fetchOrgImageModels(orgId)).models;
    case AI_VIDEO_NODE_TYPE:
      return (await fetchOrgVideoModels(orgId)).models;
    case AI_AUDIO_NODE_TYPE:
      return (await fetchOrgAudioModels(orgId)).models;
    default:
      return [];
  }
}

/** Resolve and apply a model binding for a new reference connection (no workflow default update). */
export async function resolveAddNodeReferenceModel(params: {
  readonly orgId: string | undefined;
  readonly targetType: AiGenerativeNodeType;
  readonly targetNodeData: WorkflowNodeType;
  readonly connection: Connection;
  readonly sourceNodeType: string | undefined;
  readonly generativeDefaults: WorkflowGenerativeDefaults | undefined;
}): Promise<ResolveAddNodeReferenceModelResult> {
  const modality = generativeModalityForNodeType(params.targetType);
  if (!modality || !params.orgId) {
    return { canConnect: false, nodeData: params.targetNodeData };
  }

  const models = await fetchModelsForType(params.orgId, params.targetType);
  if (models.length === 0) {
    return { canConnect: false, nodeData: params.targetNodeData };
  }

  const modelFits = createProjectedModelFits({
    targetType: params.targetType,
    connection: params.connection,
    sourceNodeType: params.sourceNodeType,
  });

  const resolution = resolveModelForNewReference({
    models,
    targetNodeData: params.targetNodeData,
    modelFits,
  });

  if (!resolution.canConnect || !resolution.effectiveModel) {
    return { canConnect: false, nodeData: params.targetNodeData };
  }

  const bindingPatch = applyModelBindingToNodeData({
    model: resolution.effectiveModel,
    current: params.targetNodeData,
    modality,
    updateWorkflowDefault: false,
    generativeDefaults: params.generativeDefaults,
    handlers: generativeModelBindingHandlersForModality(modality),
  });

  return {
    canConnect: true,
    nodeData: {
      ...params.targetNodeData,
      ...bindingPatch,
      metadata: {
        ...(params.targetNodeData.metadata ?? {}),
        ...(bindingPatch.metadata ?? {}),
      },
      inputs: bindingPatch.inputs ?? params.targetNodeData.inputs,
    },
  };
}
