import { buildOrgModelOptionId, parseOrgModelOptionId } from "@dafthunk/types";

import { upsertNodeInputValues } from "./workflow-context";
import type { WorkflowParameter } from "./workflow-types";

export interface OrgModelBindingRef {
  readonly optionId: string;
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly selectable: boolean;
}

export interface ModelSelectionRecord {
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly instanceId?: string;
}

export interface ModelBindingRef {
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly instanceId?: string;
}

export type GenerativeModelModality = "text" | "image" | "video" | "audio";

export type ModelResolutionSource = "node" | "workflow" | "list";

export interface ModelResolution<T extends OrgModelBindingRef> {
  readonly model: T;
  readonly source: ModelResolutionSource;
}

export type ModelCardState<T extends OrgModelBindingRef> =
  | { readonly status: "loading" }
  | { readonly status: "pick" }
  | { readonly status: "ready"; readonly model: T; readonly source: ModelResolutionSource };

export function readModelSelectionRecord(params: {
  readonly modelId: string;
  readonly interfaceId: string;
  readonly instanceId?: string;
}): ModelSelectionRecord | undefined {
  const canonicalId = params.modelId.trim();
  const interfaceId = params.interfaceId.trim();
  const instanceId = params.instanceId?.trim();
  if (!canonicalId || !interfaceId) {
    return undefined;
  }
  return {
    canonicalId,
    interfaceId,
    ...(instanceId ? { instanceId } : {}),
  };
}

export function resolveSelectedModelBinding<T extends OrgModelBindingRef>(
  models: readonly T[],
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): T | undefined {
  const trimmedInstanceId = instanceId?.trim();
  if (trimmedInstanceId) {
    const byInstance = models.find(
      (entry) =>
        entry.instanceId === trimmedInstanceId &&
        entry.interfaceId === interfaceId.trim()
    );
    if (byInstance) {
      return byInstance;
    }
  }

  if (!canonicalId.trim()) {
    return undefined;
  }

  if (interfaceId.trim()) {
    const matches = models.filter(
      (entry) =>
        entry.canonicalId === canonicalId &&
        entry.interfaceId === interfaceId.trim()
    );
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1 && trimmedInstanceId) {
      return matches.find((entry) => entry.instanceId === trimmedInstanceId);
    }
    if (matches.length > 1) {
      return matches.find((entry) => entry.selectable) ?? matches[0];
    }
  }

  return undefined;
}

export function pickFirstSelectableModelBinding<T extends OrgModelBindingRef>(
  models: readonly T[]
): T | undefined {
  return models.find((entry) => entry.selectable);
}

/** @deprecated Use pickFirstSelectableModelBinding */
export const pickPreviewModelBinding = pickFirstSelectableModelBinding;

/** Layer A: resolve effective model from node, workflow default, or list order. */
export function resolveEffectiveGenerativeModel<T extends OrgModelBindingRef>(
  params: {
    readonly nodeBinding: ModelSelectionRecord | undefined;
    readonly workflowDefault: ModelBindingRef | undefined;
    readonly models: readonly T[];
  }
): ModelResolution<T> | undefined {
  const { nodeBinding, workflowDefault, models } = params;

  if (nodeBinding) {
    const match = resolveSelectedModelBinding(
      models,
      nodeBinding.canonicalId,
      nodeBinding.interfaceId,
      nodeBinding.instanceId
    );
    if (match?.selectable) {
      return { model: match, source: "node" };
    }
  }

  if (workflowDefault) {
    const match = resolveSelectedModelBinding(
      models,
      workflowDefault.canonicalId,
      workflowDefault.interfaceId,
      workflowDefault.instanceId
    );
    if (match?.selectable) {
      return { model: match, source: "workflow" };
    }
  }

  const fallback = pickFirstSelectableModelBinding(models);
  if (fallback) {
    return { model: fallback, source: "list" };
  }

  return undefined;
}

export function resolveModelCardState<T extends OrgModelBindingRef>(
  resolution: ModelResolution<T> | undefined,
  isLoading: boolean
): ModelCardState<T> {
  if (isLoading) {
    return { status: "loading" };
  }
  if (resolution) {
    return {
      status: "ready",
      model: resolution.model,
      source: resolution.source,
    };
  }
  return { status: "pick" };
}

export function buildModelBindingOptionId(
  interfaceId: string,
  instanceId: string
): string {
  return buildOrgModelOptionId(interfaceId, instanceId);
}

export function resolveModelBindingFromOptionId<T extends OrgModelBindingRef>(
  models: readonly T[],
  optionId: string
): T | undefined {
  const parsed = parseOrgModelOptionId(optionId);
  if (!parsed) {
    return undefined;
  }
  return models.find(
    (entry) =>
      entry.interfaceId === parsed.interfaceId &&
      entry.instanceId === parsed.instanceId
  );
}

/** Write model binding + generation params onto node inputs. */
export function persistGenerativeBindingWithParams(
  inputs: readonly WorkflowParameter[],
  binding: ModelBindingRef,
  params: Readonly<Record<string, unknown>>
): WorkflowParameter[] {
  return upsertNodeInputValues(
    persistModelBindingToInputs(inputs, binding),
    { params },
    { params: "json" }
  );
}

/** Write model selection record (picker or explicit history replace). */
export function persistModelBindingToInputs(
  inputs: readonly WorkflowParameter[],
  binding: ModelBindingRef
): WorkflowParameter[] {
  return upsertNodeInputValues(inputs, {
    model: binding.canonicalId,
    ai_interface_id: binding.interfaceId,
    ...(binding.instanceId?.trim()
      ? { model_instance_id: binding.instanceId.trim() }
      : { model_instance_id: "" }),
  });
}

export interface HistoryModelBinding {
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly modelInstanceId?: string;
}

export function resolveHistoryModelBinding(
  item: HistoryModelBinding | undefined
): ModelBindingRef | undefined {
  const canonicalId = item?.platformModelId?.trim();
  const interfaceId = item?.aiInterfaceId?.trim();
  const instanceId = item?.modelInstanceId?.trim();
  if (!canonicalId || !interfaceId) {
    return undefined;
  }

  return {
    canonicalId,
    interfaceId,
    ...(instanceId ? { instanceId } : {}),
  };
}

/** Copy usage record from history into node model selection record. */
export function applyHistoryItemModelBinding(
  inputs: readonly WorkflowParameter[],
  item: HistoryModelBinding
): WorkflowParameter[] {
  const binding = resolveHistoryModelBinding(item);
  if (!binding) {
    return [...inputs];
  }

  return persistModelBindingToInputs(inputs, binding);
}

export function clearModelBindingInputs(
  inputs: readonly WorkflowParameter[]
): WorkflowParameter[] {
  return inputs.map((input) =>
    input.id === "model" ||
    input.id === "ai_interface_id" ||
    input.id === "model_instance_id"
      ? ({ ...input, value: "" } as WorkflowParameter)
      : input
  );
}

/** Layer A legacy alias */
export function resolveModelCandidate<T extends OrgModelBindingRef>(
  selection: ModelSelectionRecord | undefined,
  models: readonly T[]
): T | undefined {
  return resolveEffectiveGenerativeModel({
    nodeBinding: selection,
    workflowDefault: undefined,
    models,
  })?.model;
}
