import type { UpstreamParamProfileField } from "@dafthunk/types";

export {
  AiImageParamsPopover as AiVideoParamsPopover,
  type AiImageParamsPopoverProps as AiVideoParamsPopoverProps,
} from "./ai-image-params-popover";

export function buildDefaultVideoGenerationParams(
  fields: readonly UpstreamParamProfileField[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.default !== undefined) {
      out[field.name] = field.default;
    }
  }
  return out;
}

export function readAiVideoGenerationParams(
  inputs: readonly { readonly id: string; readonly value?: unknown }[]
): Record<string, unknown> {
  const raw = inputs.find((input) => input.id === "params")?.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}
