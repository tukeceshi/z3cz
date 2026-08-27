export const AI_VIDEO_PANEL_META_KEY = "aiVideoPanel" as const;

export type AiVideoPanelKind = "generate" | "enhance";

export interface AiVideoPanelMetadata {
  readonly kind: AiVideoPanelKind;
}

export function parseAiVideoPanelKind(
  metadata: Readonly<Record<string, string>> | undefined
): AiVideoPanelKind {
  const raw = metadata?.[AI_VIDEO_PANEL_META_KEY]?.trim();
  if (!raw) {
    return "generate";
  }
  try {
    const parsed = JSON.parse(raw) as AiVideoPanelMetadata;
    return parsed.kind === "enhance" ? "enhance" : "generate";
  } catch {
    return "generate";
  }
}

export function isAiVideoEnhancePanel(
  metadata: Readonly<Record<string, string>> | undefined
): boolean {
  return parseAiVideoPanelKind(metadata) === "enhance";
}

export function serializeAiVideoPanelMetadata(
  kind: AiVideoPanelKind
): string {
  return JSON.stringify({ kind } satisfies AiVideoPanelMetadata);
}

export function withAiVideoPanelKind(
  metadata: Readonly<Record<string, string>> | undefined,
  kind: AiVideoPanelKind
): Record<string, string> {
  return {
    ...(metadata ?? {}),
    [AI_VIDEO_PANEL_META_KEY]: serializeAiVideoPanelMetadata(kind),
  };
}
