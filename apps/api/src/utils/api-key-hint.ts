const MASKED_SHORT_KEY = "••••••••" as const;

export function buildApiKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return MASKED_SHORT_KEY;
  }
  if (trimmed.length <= 8) {
    return MASKED_SHORT_KEY;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function readApiKeyHint(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const hint = (metadata as Record<string, unknown>).apiKeyHint;
  return typeof hint === "string" && hint.trim() ? hint.trim() : undefined;
}

export function withApiKeyHint<T extends Record<string, unknown>>(
  metadata: T,
  apiKey: string
): T & { readonly apiKeyHint: string } {
  return {
    ...metadata,
    apiKeyHint: buildApiKeyHint(apiKey),
  };
}

export function mergeApiKeyHintIntoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  apiKey: string
): Record<string, unknown> {
  return withApiKeyHint(metadata ?? {}, apiKey);
}
