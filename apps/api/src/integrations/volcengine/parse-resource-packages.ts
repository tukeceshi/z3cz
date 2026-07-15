import type { VolcanoResourcePackageRow } from "@dafthunk/types";
import {
  isEffectiveResourcePackage,
  isUsageCountableResourcePackage,
  parseVolcanoPackageAmount,
  VOLCANO_USAGE_PACKAGE_STATUSES,
  type VolcanoUsagePackageStatus,
} from "@dafthunk/types";

export type { VolcanoResourcePackageRow, VolcanoUsagePackageStatus };
export {
  isEffectiveResourcePackage,
  isUsageCountableResourcePackage,
  VOLCANO_USAGE_PACKAGE_STATUSES,
};

/** @deprecated Use parseVolcanoPackageAmount from @dafthunk/types */
export const parsePackageAmount = parseVolcanoPackageAmount;

export function indexResourcePackagesByConfigurationCode(
  rows: readonly VolcanoResourcePackageRow[]
): Map<string, VolcanoResourcePackageRow[]> {
  const index = new Map<string, VolcanoResourcePackageRow[]>();

  for (const row of rows) {
    const code = row.ConfigurationCode?.trim();
    if (!code) continue;

    const current = index.get(code) ?? [];
    current.push(row);
    index.set(code, current);
  }

  return index;
}
