import type { VolcanoTosPackageUsage } from "./volcano-snapshot";
import type { VolcanoResourcePackageRow } from "./volcano-resource-package-usage";
import {
  isUsageCountableResourcePackage,
  parseVolcanoPackageAmount,
  VOLCANO_RESOURCE_PACKAGE_STATUS,
} from "./volcano-resource-package-usage";

function packageHaystack(row: VolcanoResourcePackageRow): string {
  return [
    row.Product,
    row.ConfigurationCode,
    row.ConfigurationName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isTosRelated(row: VolcanoResourcePackageRow): boolean {
  const hay = packageHaystack(row);
  return hay.includes("tos") || hay.includes("对象存储");
}

function isTosApiRequestPackage(row: VolcanoResourcePackageRow): boolean {
  const hay = packageHaystack(row);
  return (
    hay.includes("api_requests") ||
    hay.includes("api requests") ||
    hay.includes("请求") ||
    hay.includes("万次")
  );
}

function isTosCapacityUnit(unit: string | undefined): boolean {
  const normalized = unit?.trim().toLowerCase();
  return normalized === "gib" || normalized === "gb";
}

export function isTosStorageResourcePackage(
  row: VolcanoResourcePackageRow
): boolean {
  if (!isTosRelated(row)) return false;
  if (isTosApiRequestPackage(row)) return false;
  if (isTosTrafficResourcePackage(row)) return false;

  if (isTosCapacityUnit(row.Unit)) return true;

  const hay = packageHaystack(row);
  return (
    (hay.includes("standard_storage") || hay.includes("standard storage")) &&
    (hay.includes("storage") || hay.includes("存储") || hay.includes("容量"))
  );
}

export function isTosTrafficResourcePackage(
  row: VolcanoResourcePackageRow
): boolean {
  if (!isTosRelated(row)) return false;
  const hay = packageHaystack(row);
  if (
    hay.includes("cdn") ||
    hay.includes("cross_region") ||
    hay.includes("accelerate") ||
    hay.includes("跨域") ||
    hay.includes("回源")
  ) {
    return false;
  }

  return (
    hay.includes("traffic_cost_busy") ||
    hay.includes("traffic cost busy") ||
    (hay.includes("traffic") && hay.includes("流量"))
  );
}

function countPackagesByStatus(
  rows: readonly VolcanoResourcePackageRow[],
  status: (typeof VOLCANO_RESOURCE_PACKAGE_STATUS)[keyof typeof VOLCANO_RESOURCE_PACKAGE_STATUS]
): number {
  let count = 0;
  for (const row of rows) {
    if (row.Status === status) count += 1;
  }
  return count;
}

function sumPackageFieldByStatus(
  rows: readonly VolcanoResourcePackageRow[],
  status: (typeof VOLCANO_RESOURCE_PACKAGE_STATUS)[keyof typeof VOLCANO_RESOURCE_PACKAGE_STATUS],
  field: "TotalAmount" | "AvailableAmount"
): number {
  let sum = 0;
  for (const row of rows) {
    if (row.Status !== status) continue;
    sum += parseVolcanoPackageAmount(row[field]);
  }
  return sum;
}

function aggregateTosCapacityPackageRows(
  rows: readonly VolcanoResourcePackageRow[]
): VolcanoTosPackageUsage | null {
  const usageRows = rows.filter(
    (row) =>
      isUsageCountableResourcePackage(row) &&
      isTosCapacityUnit(row.Unit) &&
      !isTosApiRequestPackage(row)
  );
  if (usageRows.length === 0) return null;

  const effective = VOLCANO_RESOURCE_PACKAGE_STATUS.Effective;
  const usedUp = VOLCANO_RESOURCE_PACKAGE_STATUS.UsedUp;
  const expiredStatus = VOLCANO_RESOURCE_PACKAGE_STATUS.Expired;

  const quota =
    sumPackageFieldByStatus(usageRows, effective, "TotalAmount") +
    sumPackageFieldByStatus(usageRows, usedUp, "TotalAmount") +
    sumPackageFieldByStatus(usageRows, expiredStatus, "TotalAmount");

  const remaining = sumPackageFieldByStatus(
    usageRows,
    effective,
    "AvailableAmount"
  );
  const expired = sumPackageFieldByStatus(
    usageRows,
    expiredStatus,
    "AvailableAmount"
  );
  const used = Math.max(0, quota - remaining - expired);

  const usagePercent =
    quota > 0
      ? Math.max(0, Math.min(100, Math.round((remaining / quota) * 100)))
      : 0;

  return {
    used,
    remaining,
    expired,
    quota,
    unit: "gb",
    usagePercent,
    overQuota: quota > 0 && remaining <= 0,
    packageStatus: {
      effectiveCount: countPackagesByStatus(usageRows, effective),
      usedUpCount: countPackagesByStatus(usageRows, usedUp),
      expiredCount: countPackagesByStatus(usageRows, expiredStatus),
      effectiveRemaining: remaining,
      usedUpConsumed: sumPackageFieldByStatus(usageRows, usedUp, "TotalAmount"),
      expiredUnused: expired,
    },
  };
}

function aggregateTosTrafficPackageRows(
  rows: readonly VolcanoResourcePackageRow[]
): VolcanoTosPackageUsage | null {
  const usageRows = rows.filter(
    (row) =>
      isUsageCountableResourcePackage(row) &&
      row.Unit?.trim().toLowerCase() === "gb"
  );
  if (usageRows.length === 0) return null;

  const effective = VOLCANO_RESOURCE_PACKAGE_STATUS.Effective;
  const usedUp = VOLCANO_RESOURCE_PACKAGE_STATUS.UsedUp;
  const expiredStatus = VOLCANO_RESOURCE_PACKAGE_STATUS.Expired;

  const quota =
    sumPackageFieldByStatus(usageRows, effective, "TotalAmount") +
    sumPackageFieldByStatus(usageRows, usedUp, "TotalAmount") +
    sumPackageFieldByStatus(usageRows, expiredStatus, "TotalAmount");

  const remaining = sumPackageFieldByStatus(
    usageRows,
    effective,
    "AvailableAmount"
  );
  const expired = sumPackageFieldByStatus(
    usageRows,
    expiredStatus,
    "AvailableAmount"
  );
  const used = Math.max(0, quota - remaining - expired);

  const usagePercent =
    quota > 0
      ? Math.max(0, Math.min(100, Math.round((remaining / quota) * 100)))
      : 0;

  return {
    used,
    remaining,
    expired,
    quota,
    unit: "gb",
    usagePercent,
    overQuota: quota > 0 && remaining <= 0,
    packageStatus: {
      effectiveCount: countPackagesByStatus(usageRows, effective),
      usedUpCount: countPackagesByStatus(usageRows, usedUp),
      expiredCount: countPackagesByStatus(usageRows, expiredStatus),
      effectiveRemaining: remaining,
      usedUpConsumed: sumPackageFieldByStatus(usageRows, usedUp, "TotalAmount"),
      expiredUnused: expired,
    },
  };
}

export function buildTosPackageUsageFromRows(
  rows: readonly VolcanoResourcePackageRow[]
): {
  readonly storageUsage: VolcanoTosPackageUsage | null;
  readonly trafficUsage: VolcanoTosPackageUsage | null;
} {
  const storageRows = rows.filter(isTosStorageResourcePackage);
  const trafficRows = rows.filter(isTosTrafficResourcePackage);

  return {
    storageUsage: aggregateTosCapacityPackageRows(storageRows),
    trafficUsage: aggregateTosTrafficPackageRows(trafficRows),
  };
}
