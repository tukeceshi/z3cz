export const VOLCANO_PRODUCT_DISPLAY_NAME_ZH =
  "火山引擎-火山方舟-字节跳动旗下" as const;

export const VOLCANO_PRODUCT_DISPLAY_NAME_EN =
  "Volcengine Ark (ByteDance)" as const;

/** Legacy short names stored before branding unification. */
export const VOLCANO_LEGACY_INTERFACE_NAMES = [
  "火山引擎-火山方舟",
  VOLCANO_PRODUCT_DISPLAY_NAME_ZH,
] as const;

export function resolveVolcanoInterfaceDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "火山引擎-火山方舟") {
    return VOLCANO_PRODUCT_DISPLAY_NAME_ZH;
  }
  return trimmed;
}
