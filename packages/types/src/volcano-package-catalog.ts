export const VOLCANO_PACKAGE_CONFIG_BY_CANONICAL_ID = {
  "deepseek-v4-pro": ["DeepSeek_V4_pro_free_inference_resource_pack"],
  "deepseek-v4-flash": ["DeepSeek_V4_flash_free_inference_resource_pack"],
  "glm-5-2": ["GLM_5.2_free_inference_resource_pack"],
  "doubao-seedance-2": ["Doubao_Seedance_2.0_pack_free_infer"],
  "doubao-seedance-2-fast": ["Doubao_Seedance_2.0_fast_pack_free_infer"],
  "doubao-seedance-2-mini": ["Doubao_Seedance_2.0_mini_pack_free_infer"],
  "doubao-seedream-5": ["Doubao_Seedream_5.0_pack_free_infer"],
  "doubao-seed-evolving": [],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export function volcanoPackageCodesForCanonicalId(
  canonicalId: string
): readonly string[] {
  const codes =
    VOLCANO_PACKAGE_CONFIG_BY_CANONICAL_ID[
      canonicalId as keyof typeof VOLCANO_PACKAGE_CONFIG_BY_CANONICAL_ID
    ];
  return codes ?? [];
}

export function volcanoHasPackageMapping(canonicalId: string): boolean {
  return volcanoPackageCodesForCanonicalId(canonicalId).length > 0;
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
  "doubao-seed-evolving": "none",
} as const satisfies Readonly<
  Record<string, VolcanoPackageProvisionMode>
>;

export function volcanoPackageProvisionModeForCanonicalId(
  canonicalId: string
): VolcanoPackageProvisionMode {
  const mode =
    VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID[
      canonicalId as keyof typeof VOLCANO_PACKAGE_PROVISION_MODE_BY_CANONICAL_ID
    ];
  if (mode) return mode;
  return volcanoHasPackageMapping(canonicalId) ? "required" : "none";
}
