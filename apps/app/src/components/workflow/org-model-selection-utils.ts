import {
  buildOrgModelOptionId,
  DEEPSEEK_V4_FLASH_CANONICAL_ID,
} from "@dafthunk/types";

import { upsertNodeInputValues } from "./workflow-context";
import type { WorkflowParameter } from "./workflow-types";

export interface OrgModelBindingRef {
  readonly optionId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly selectable: boolean;
}

export interface ModelBindingRef {
  readonly canonicalId: string;
  readonly interfaceId: string;
}

export type GenerativeModelModality = "text" | "image" | "video" | "audio";

const LAST_USED_MODEL_STORAGE_PREFIX = "dafthunk:last-model:";

function lastUsedModelStorageKey(
  orgId: string,
  modality: GenerativeModelModality
): string {
  return `${LAST_USED_MODEL_STORAGE_PREFIX}${orgId}:${modality}`;
}

export function readLastUsedModelBinding(
  orgId: string,
  modality: GenerativeModelModality
): ModelBindingRef | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }

  try {
    const raw = sessionStorage.getItem(lastUsedModelStorageKey(orgId, modality));
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as {
      canonicalId?: string;
      interfaceId?: string;
    };
    const canonicalId = parsed.canonicalId?.trim();
    if (!canonicalId) {
      return undefined;
    }

    return {
      canonicalId,
      interfaceId: parsed.interfaceId?.trim() ?? "",
    };
  } catch {
    return undefined;
  }
}

export function writeLastUsedModelBinding(
  orgId: string,
  modality: GenerativeModelModality,
  binding: ModelBindingRef
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  const canonicalId = binding.canonicalId.trim();
  if (!canonicalId) {
    return;
  }

  try {
    sessionStorage.setItem(
      lastUsedModelStorageKey(orgId, modality),
      JSON.stringify({
        canonicalId,
        interfaceId: binding.interfaceId.trim(),
      })
    );
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

export function rememberModelBinding(
  orgId: string | undefined,
  modality: GenerativeModelModality,
  binding: ModelBindingRef | undefined
): void {
  if (!orgId || !binding?.canonicalId.trim()) {
    return;
  }

  writeLastUsedModelBinding(orgId, modality, binding);
}

export interface HistoryModelBinding {
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
}

export interface HistoryModelBindingSource<
  T extends HistoryModelBinding & { readonly id: string },
> {
  readonly items: readonly T[];
  readonly selectedId: string | null;
}

export function resolveSelectedModelBinding<T extends OrgModelBindingRef>(
  models: readonly T[],
  canonicalId: string,
  interfaceId: string
): T | undefined {
  if (interfaceId) {
    const exact = models.find(
      (entry) =>
        entry.canonicalId === canonicalId &&
        entry.interfaceId === interfaceId
    );
    if (exact) {
      return exact;
    }
  }

  return models.find(
    (entry) => entry.canonicalId === canonicalId && entry.selectable
  );
}

export function pickDefaultModelBinding<T extends OrgModelBindingRef>(
  models: readonly T[]
): T | undefined {
  const selectable = models.filter((entry) => entry.selectable);
  if (selectable.length === 0) {
    return undefined;
  }

  return (
    selectable.find(
      (entry) => entry.canonicalId === DEEPSEEK_V4_FLASH_CANONICAL_ID
    ) ?? selectable[0]
  );
}

export function buildModelBindingOptionId(
  interfaceId: string,
  canonicalId: string
): string {
  return buildOrgModelOptionId(interfaceId, canonicalId);
}

export function persistModelBindingToInputs(
  inputs: readonly WorkflowParameter[],
  binding: ModelBindingRef
): WorkflowParameter[] {
  return upsertNodeInputValues(inputs, {
    model: binding.canonicalId,
    ai_interface_id: binding.interfaceId,
  });
}

export function resolveHistoryModelBinding(
  item: HistoryModelBinding | undefined
): ModelBindingRef | undefined {
  const canonicalId = item?.platformModelId?.trim();
  if (!canonicalId) {
    return undefined;
  }

  return {
    canonicalId,
    interfaceId: item?.aiInterfaceId?.trim() ?? "",
  };
}

export function resolveHistoryModelBindingFromItems<
  T extends HistoryModelBinding & { readonly id: string },
>(history: HistoryModelBindingSource<T>): ModelBindingRef | undefined {
  const item =
    (history.selectedId
      ? history.items.find((entry) => entry.id === history.selectedId)
      : undefined) ?? history.items[0];

  return resolveHistoryModelBinding(item);
}

export function applyHistoryItemModelBinding(
  inputs: readonly WorkflowParameter[],
  item: HistoryModelBinding
): WorkflowParameter[] {
  const binding = resolveHistoryModelBinding(item);
  if (!binding) {
    return [...inputs];
  }

  if (!binding.interfaceId) {
    return upsertNodeInputValues(inputs, { model: binding.canonicalId });
  }

  return persistModelBindingToInputs(inputs, binding);
}

export function pickInitialModelBinding<T extends OrgModelBindingRef>(
  models: readonly T[],
  historyBinding: ModelBindingRef | undefined,
  lastUsedBinding: ModelBindingRef | undefined = undefined
): T | undefined {
  if (historyBinding?.canonicalId && historyBinding.interfaceId) {
    const exact = resolveSelectedModelBinding(
      models,
      historyBinding.canonicalId,
      historyBinding.interfaceId
    );
    if (exact?.selectable) {
      return exact;
    }
  }

  if (historyBinding?.canonicalId) {
    const fromHistory = resolveSelectedModelBinding(
      models,
      historyBinding.canonicalId,
      historyBinding.interfaceId
    );
    if (fromHistory?.selectable) {
      return fromHistory;
    }
  }

  if (lastUsedBinding?.canonicalId && lastUsedBinding.interfaceId) {
    const exact = resolveSelectedModelBinding(
      models,
      lastUsedBinding.canonicalId,
      lastUsedBinding.interfaceId
    );
    if (exact?.selectable) {
      return exact;
    }
  }

  if (lastUsedBinding?.canonicalId) {
    const fromLastUsed = resolveSelectedModelBinding(
      models,
      lastUsedBinding.canonicalId,
      lastUsedBinding.interfaceId
    );
    if (fromLastUsed?.selectable) {
      return fromLastUsed;
    }
  }

  return pickDefaultModelBinding(models);
}

export type HydrateModelBindingAction =
  | { readonly kind: "none" }
  | { readonly kind: "fill_interface"; readonly interfaceId: string }
  | { readonly kind: "clear" };

export function resolveHydrateModelBindingAction<T extends OrgModelBindingRef>(
  models: readonly T[],
  canonicalId: string,
  interfaceId: string
): HydrateModelBindingAction {
  const modelId = canonicalId.trim();
  if (!modelId) {
    return { kind: "none" };
  }

  const ifaceId = interfaceId.trim();
  if (ifaceId) {
    const exact = models.some(
      (entry) =>
        entry.canonicalId === modelId &&
        entry.interfaceId === ifaceId &&
        entry.selectable
    );
    return exact ? { kind: "none" } : { kind: "clear" };
  }

  const matches = models.filter(
    (entry) => entry.canonicalId === modelId && entry.selectable
  );
  if (matches.length === 1) {
    return { kind: "fill_interface", interfaceId: matches[0]!.interfaceId };
  }
  if (matches.length === 0) {
    return { kind: "clear" };
  }

  return { kind: "none" };
}

export function clearModelBindingInputs(
  inputs: readonly WorkflowParameter[]
): WorkflowParameter[] {
  return inputs.map((input) =>
    input.id === "model" || input.id === "ai_interface_id"
      ? ({ ...input, value: "" } as WorkflowParameter)
      : input
  );
}
