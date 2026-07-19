/** Supported Volcano TOS regions for org cloud storage setup. */
export interface VolcanoTosRegionOption {
  readonly code: string;
  readonly labelKey:
    | "pages.aiInterfaces.tosStorage.regions.guangzhou"
    | "pages.aiInterfaces.tosStorage.regions.beijing"
    | "pages.aiInterfaces.tosStorage.regions.shanghai"
    | "pages.aiInterfaces.tosStorage.regions.jakarta"
    | "pages.aiInterfaces.tosStorage.regions.johor";
}

export const VOLCANO_TOS_REGIONS: readonly VolcanoTosRegionOption[] = [
  {
    code: "cn-guangzhou",
    labelKey: "pages.aiInterfaces.tosStorage.regions.guangzhou",
  },
  {
    code: "cn-beijing",
    labelKey: "pages.aiInterfaces.tosStorage.regions.beijing",
  },
  {
    code: "cn-shanghai",
    labelKey: "pages.aiInterfaces.tosStorage.regions.shanghai",
  },
  {
    code: "ap-southeast-1",
    labelKey: "pages.aiInterfaces.tosStorage.regions.johor",
  },
  {
    code: "ap-southeast-3",
    labelKey: "pages.aiInterfaces.tosStorage.regions.jakarta",
  },
] as const;

export const VOLCANO_TOS_DEFAULT_PREFIX = "z3cz" as const;

export function defaultVolcanoTosRegionForLocale(
  locale: string
): string {
  if (locale.startsWith("zh")) {
    return "cn-guangzhou";
  }
  return "ap-southeast-3";
}
