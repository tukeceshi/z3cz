export const GENERATIVE_CONTENT_MODE_META_KEY = "generativeContentMode" as const;
export const GENERATIVE_CARD_EDITING_META_KEY = "generativeCardEditing" as const;

export const GENERATIVE_CONTENT_MODE_MANUAL = "manual" as const;
export const GENERATIVE_CONTENT_MODE_GENERATED = "generated" as const;

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
  return !isGenerativeManualContent(metadata);
}
