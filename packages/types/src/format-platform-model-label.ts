import type { AiModelModality } from "./ai-model-catalog";

export function formatPlatformModelLabel(params: {
  readonly alias: string;
  readonly modalityLabel: string;
}): string {
  return `${params.alias}（${params.modalityLabel}）`;
}

export type PlatformModelModalityLabelKey = AiModelModality;
