import {
  sanitizeImageGenerationParams,
  type UpstreamParamProfileField,
} from "@dafthunk/types";

export {
  AiImageParamsPopover as AiVideoParamsPopover,
  type AiImageParamsPopoverProps as AiVideoParamsPopoverProps,
} from "./ai-image-params-popover";

import { readNodeGenerationParams } from "./generative-card-params";

export function buildDefaultVideoGenerationParams(
  fields: readonly UpstreamParamProfileField[]
): Record<string, unknown> {
  return sanitizeImageGenerationParams(fields);
}

export function readAiVideoGenerationParams(
  inputs: readonly { readonly id: string; readonly value?: unknown }[]
): Record<string, unknown> {
  return readNodeGenerationParams(inputs);
}
