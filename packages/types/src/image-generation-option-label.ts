/** Label for `auto` / `adaptive` on image size & ratio fields (UI: 智能). */
export interface ImageGenerationOptionLabels {
  readonly smartOption?: string;
  readonly optimizePromptStandard?: string;
  readonly optimizePromptFast?: string;
}

export function formatImageGenerationOptionLabel(
  fieldName: string,
  option: string,
  smartLabel: string,
  labels?: ImageGenerationOptionLabels
): string {
  if (fieldName === "optimize_prompt_mode") {
    if (option === "standard" && labels?.optimizePromptStandard) {
      return labels.optimizePromptStandard;
    }
    if (option === "fast" && labels?.optimizePromptFast) {
      return labels.optimizePromptFast;
    }
  }

  if (
    (fieldName === "size" ||
      fieldName === "resolution" ||
      fieldName === "ratio" ||
      fieldName === "aspect_ratio") &&
    (option === "auto" || option === "adaptive")
  ) {
    return smartLabel;
  }
  return option;
}
