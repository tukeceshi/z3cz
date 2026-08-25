/**
 * Public context windows from each vendor family.
 * Used when catalog rows still carry the old 1_048_576 placeholder.
 */
export const TEXT_MODEL_CONTEXT_WINDOW_TOKENS = {
  "deepseek-v4-flash": 128_000,
  "deepseek-v4-pro": 128_000,
  "doubao-seed-evolving": 256_000,
  "glm-5-2": 128_000,
  "kimi-k3": 256_000,
  "kimi-k2.6": 256_000,
  "kimi-k2.5": 256_000,
  "gpt-5-6-sol": 400_000,
  "gpt-5-6-terra": 400_000,
  "gpt-5-6-luna": 400_000,
  "gemini-3-5-flash": 1_048_576,
  "gemini-3-6-flash": 1_048_576,
  "gemini-3-5-flash-lite": 1_048_576,
  "grok-4-5": 256_000,
  "grok-4-3": 256_000,
  "claude-sonnet-5": 200_000,
  "claude-opus-5": 200_000,
  "claude-haiku-4-5": 200_000,
} as const;

export const PLACEHOLDER_CONTEXT_WINDOW_TOKENS = 1_048_576;

export function contextWindowTokensForCanonicalId(
  canonicalId: string,
  stored?: number
): number {
  if (
    typeof stored === "number" &&
    stored > 0 &&
    stored !== PLACEHOLDER_CONTEXT_WINDOW_TOKENS
  ) {
    return stored;
  }
  const published =
    TEXT_MODEL_CONTEXT_WINDOW_TOKENS[
      canonicalId as keyof typeof TEXT_MODEL_CONTEXT_WINDOW_TOKENS
    ];
  return published ?? 128_000;
}
