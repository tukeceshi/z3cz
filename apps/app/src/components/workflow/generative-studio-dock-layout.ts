import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";

export const STUDIO_DOCK_PROMPT_HEIGHT_PX = 270;

export type StudioDockSize = "compact" | "expanded";

interface StudioPromptBoxParams {
  readonly layout: GenerativeConfigPanelLayout;
  readonly hasPromptReference: boolean;
  readonly allowUpload: boolean;
  readonly referenceChips: readonly { readonly kind: string }[];
}

/** Upload-only image/video refs in studio: expanded resource box, no prompt field. */
export function shouldShowStudioPromptBox({
  layout,
  hasPromptReference,
  allowUpload,
  referenceChips,
}: StudioPromptBoxParams): boolean {
  if (layout !== "studio-dock") {
    return true;
  }
  if (hasPromptReference) {
    return true;
  }

  const hasMediaRefs = referenceChips.some(
    (chip) => chip.kind === "image" || chip.kind === "video"
  );
  const hasTextRef = referenceChips.some((chip) => chip.kind === "text");

  if (allowUpload && hasMediaRefs && !hasTextRef) {
    return false;
  }

  return true;
}

export function studioDockSizeForPanel(
  params: StudioPromptBoxParams
): StudioDockSize | undefined {
  if (params.layout !== "studio-dock") {
    return undefined;
  }
  return shouldShowStudioPromptBox(params) ? "compact" : "expanded";
}
