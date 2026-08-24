export const AI_TEXT_STAGING_STATE_META_KEY = "aiTextStagingState" as const;

export type AiTextStagingDisplayState =
  | "loading"
  | "ready"
  | "empty"
  | "failed";

const DISPLAY_STATES = new Set<string>([
  "loading",
  "ready",
  "empty",
  "failed",
]);

export function readAiTextStagingDisplayState(
  metadata: Record<string, string> | undefined
): AiTextStagingDisplayState | undefined {
  const value = metadata?.[AI_TEXT_STAGING_STATE_META_KEY];
  if (value && DISPLAY_STATES.has(value)) {
    return value as AiTextStagingDisplayState;
  }
  return undefined;
}

export function withAiTextStagingDisplayState(
  metadata: Record<string, string> | undefined,
  state: AiTextStagingDisplayState
): Record<string, string> | undefined {
  if (metadata?.[AI_TEXT_STAGING_STATE_META_KEY] === state) {
    return metadata;
  }

  return {
    ...(metadata ?? {}),
    [AI_TEXT_STAGING_STATE_META_KEY]: state,
  };
}
