import { isAiVideoEnhancePanel } from "@dafthunk/types";

export const GENERATIVE_CONTENT_MODE_META_KEY = "generativeContentMode" as const;
export const GENERATIVE_CARD_EDITING_META_KEY = "generativeCardEditing" as const;
export const GENERATIVE_BOTTOM_PANEL_META_KEY = "generativeBottomPanel" as const;

export const GENERATIVE_CONTENT_MODE_MANUAL = "manual" as const;
export const GENERATIVE_CONTENT_MODE_GENERATED = "generated" as const;
export const GENERATIVE_BOTTOM_PANEL_NONE = "none" as const;

export function isGenerativeManualContent(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[GENERATIVE_CONTENT_MODE_META_KEY] === GENERATIVE_CONTENT_MODE_MANUAL;
}

export function isGenerativeCardEditing(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[GENERATIVE_CARD_EDITING_META_KEY] === "1";
}

export function isGenerativeBottomPanelHidden(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[GENERATIVE_BOTTOM_PANEL_META_KEY] === GENERATIVE_BOTTOM_PANEL_NONE;
}

export function withGenerativeBottomPanelHidden(
  metadata: Record<string, string> | undefined
): Record<string, string> {
  return {
    ...(metadata ?? {}),
    [GENERATIVE_BOTTOM_PANEL_META_KEY]: GENERATIVE_BOTTOM_PANEL_NONE,
  };
}

export function withGenerativeManualContentMode(
  metadata: Record<string, string> | undefined
): Record<string, string> {
  return {
    ...(metadata ?? {}),
    [GENERATIVE_CONTENT_MODE_META_KEY]: GENERATIVE_CONTENT_MODE_MANUAL,
  };
}

export function withGenerativeGeneratedContentMode(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata?.[GENERATIVE_CONTENT_MODE_META_KEY]) {
    return metadata;
  }

  const next = { ...metadata };
  delete next[GENERATIVE_CONTENT_MODE_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function withGenerativeCardEditing(
  metadata: Record<string, string> | undefined,
  editing: boolean
): Record<string, string> | undefined {
  if (editing) {
    return { ...(metadata ?? {}), [GENERATIVE_CARD_EDITING_META_KEY]: "1" };
  }

  if (!metadata?.[GENERATIVE_CARD_EDITING_META_KEY]) {
    return metadata;
  }

  const next = { ...metadata };
  delete next[GENERATIVE_CARD_EDITING_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

/** History picker only when there are multiple AI generations to switch between. */
export function shouldShowGenerativeHistoryIcon(
  historyCount: number,
  metadata: Record<string, string> | undefined
): boolean {
  if (isGenerativeManualContent(metadata)) {
    return false;
  }
  return historyCount > 1;
}

export function shouldShowGenerativeBottomPanel(
  metadata: Record<string, string> | undefined
): boolean {
  if (isGenerativeBottomPanelHidden(metadata)) {
    return false;
  }
  if (isAiVideoEnhancePanel(metadata)) {
    return true;
  }
  return !isGenerativeManualContent(metadata);
}
