export const AI_VIDEO_PANEL_META_KEY = "aiVideoPanel" as const;

export type AiVideoPanelKind = "generate" | "enhance" | "retake";

/** @deprecated Legacy lock flag — treat as retake panel. */
export const VIDEO_RETAKE_LOCK_META_KEY = "videoRetakeLock" as const;

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
    if (parsed.kind === "enhance") {
      return "enhance";
    }
    if (parsed.kind === "retake") {
      return "retake";
    }
    return "generate";
  } catch {
    return "generate";
  }
}

export function isAiVideoEnhancePanel(
  metadata: Readonly<Record<string, string>> | undefined
): boolean {
  return parseAiVideoPanelKind(metadata) === "enhance";
}

export function isAiVideoRetakePanel(
  metadata: Readonly<Record<string, string>> | undefined
): boolean {
  if (metadata?.[VIDEO_RETAKE_LOCK_META_KEY] === "1") {
    return true;
  }
  return parseAiVideoPanelKind(metadata) === "retake";
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
