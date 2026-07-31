/**
 * Match billing ConfigurationCode to catalog models by model id.
 * Default: `canonicalId` with `-` → `_` (case-insensitive substring).
 * Exceptions only where Volcengine codes diverge.
 */
const VOLCANO_PACKAGE_MATCH_KEY_EXCEPTIONS: Readonly<Record<string, string>> = {
  "glm-5-2": "glm_5.2",
  "doubao-seedance-2-fast": "doubao_seedance_2.0_fast",
  "doubao-seedance-2-mini": "doubao_seedance_2.0_mini",
};

export function volcanoPackageMatchKeyForCanonicalId(
  canonicalId: string
): string {
  const exception = VOLCANO_PACKAGE_MATCH_KEY_EXCEPTIONS[canonicalId];
  if (exception) {
    return exception.toLowerCase();
  }
  return canonicalId.trim().toLowerCase().replace(/-/g, "_");
}

export function volcanoPackageCodeMatchesKey(
  configurationCode: string,
  matchKey: string
): boolean {
  const code = configurationCode.trim().toLowerCase();
  const key = matchKey.trim().toLowerCase();
  if (!code || !key) {
    return false;
  }
  return code.includes(key);
}

/** Longest matching key wins when several catalog models fit one package. */
export function pickVolcanoPackageOwnerCanonicalId(
  configurationCode: string,
  canonicalIds: readonly string[]
): string | null {
  let bestId: string | null = null;
  let bestKeyLength = -1;

  for (const canonicalId of canonicalIds) {
    const key = volcanoPackageMatchKeyForCanonicalId(canonicalId);
    if (!volcanoPackageCodeMatchesKey(configurationCode, key)) {
      continue;
    }
    if (key.length > bestKeyLength) {
      bestId = canonicalId;
      bestKeyLength = key.length;
    }
  }

  return bestId;
}

export type VolcanoPackageProvisionMode = "required" | "optional" | "none";

export const VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID = {
  "deepseek-v4-pro": "required",
  "deepseek-v4-flash": "required",
  "glm-5-2": "required",
  "doubao-seedance-2": "required",
  "doubao-seedance-2-fast": "required",
  "doubao-seedance-2-mini": "required",
  "doubao-seedream-5": "required",
  "doubao-seed-evolving": "required",
} as const satisfies Readonly<Record<string, VolcanoPackageProvisionMode>>;

export function volcanoPackageProvisionModeForCanonicalId(
  canonicalId: string
): VolcanoPackageProvisionMode {
  const mode =
    VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID[
      canonicalId as keyof typeof VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID
    ];
  return mode ?? "none";
}

export function volcanoHasPackageMapping(canonicalId: string): boolean {
  return volcanoPackageProvisionModeForCanonicalId(canonicalId) !== "none";
}
