export interface VolcanoFoundationModelReference {
  readonly name: string;
  readonly version: string;
}

/**
 * Derive CreateEndpoint FoundationModel reference from an online inference ModelId.
 * Examples:
 * - deepseek-v4-flash-260425 -> { name: deepseek-v4-flash, version: 260425 }
 * - glm-5-2-260617 -> { name: glm-5-2, version: 260617 }
 */
export function parseVolcanoFoundationModelReference(
  providerModelId: string
): VolcanoFoundationModelReference | null {
  const trimmed = providerModelId.trim();
  if (!trimmed) {
    return null;
  }

  const datedMatch = trimmed.match(/^(.+)-(\d{6})$/);
  if (datedMatch) {
    return {
      name: datedMatch[1]!,
      version: datedMatch[2]!,
    };
  }

  return null;
}
