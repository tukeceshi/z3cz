import {
  sanitizeImageGenerationParams,
  VIDEO_OMNI_REFERENCE_TASK_TYPE_FIELD_NAME,
  type UpstreamParamProfileField,
} from "@dafthunk/types";

import { upsertNodeInputValues } from "./workflow-context";

import type { WorkflowParameter } from "./workflow-types";

const CARD_HIDDEN_GENERATION_FIELD_NAMES: ReadonlySet<string> = new Set([
  VIDEO_OMNI_REFERENCE_TASK_TYPE_FIELD_NAME,
]);

export type CardGenerationParams =
  | { readonly visible: false }
  | {
      readonly visible: true;

      readonly fields: readonly UpstreamParamProfileField[];

      readonly values: Record<string, unknown>;
    };

export function isGenerationFieldVisibleOnCard(
  field: Pick<UpstreamParamProfileField, "name" | "hidden">
): boolean {
  return !field.hidden && !CARD_HIDDEN_GENERATION_FIELD_NAMES.has(field.name);
}

export function readNodeGenerationParams(
  inputs: readonly { readonly id: string; readonly value?: unknown }[]
): Record<string, unknown> {
  const raw = inputs.find((input) => input.id === "params")?.value;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return { ...(raw as Record<string, unknown>) };
}

/** Params visible whenever an effective model with fields is resolved. */

export function resolveCardGenerationParams(
  hasEffectiveModel: boolean,

  inputs: readonly WorkflowParameter[],

  fields: readonly UpstreamParamProfileField[]
): CardGenerationParams {
  if (!hasEffectiveModel || fields.length === 0) {
    return { visible: false };
  }

  const stored = readNodeGenerationParams(inputs);

  const values = sanitizeImageGenerationParams(fields, stored);

  return { visible: true, fields, values };
}

export function persistNodeGenerationParams(
  sanitized: Record<string, unknown>,

  currentInputs: readonly WorkflowParameter[]
): WorkflowParameter[] {
  return upsertNodeInputValues(
    currentInputs,

    { params: sanitized },

    { params: "json" }
  );
}

export { sanitizeImageGenerationParams as sanitizeCardGenerationParams };
