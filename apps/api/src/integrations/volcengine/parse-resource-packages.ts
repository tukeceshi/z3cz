export interface VolcanoResourcePackageRow {
  readonly InstanceNo?: string;
  readonly ConfigurationCode?: string;
  readonly ConfigurationName?: string;
  readonly Product?: string;
  readonly TotalAmount?: string;
  readonly AvailableAmount?: string;
  readonly Unit?: string;
  readonly Status?: string;
}

export function parsePackageAmount(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

export const VOLCANO_USAGE_PACKAGE_STATUSES = [
  "Effective",
  "UsedUp",
  "Expired",
] as const;

export type VolcanoUsagePackageStatus =
  (typeof VOLCANO_USAGE_PACKAGE_STATUSES)[number];

export function isUsageCountableResourcePackage(
  row: VolcanoResourcePackageRow
): boolean {
  const status = row.Status;
  if (!status) return false;
  return (VOLCANO_USAGE_PACKAGE_STATUSES as readonly string[]).includes(status);
}

export function isEffectiveResourcePackage(
  row: VolcanoResourcePackageRow
): boolean {
  return row.Status === "Effective";
}
