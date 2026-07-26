import type { VolcanoModelUsage } from "./volcano-snapshot";

export interface VolcanoResourcePackageRow {
  readonly InstanceNo?: string;
  readonly ConfigurationCode?: string;
  readonly ConfigurationName?: string;
  readonly Product?: string;
  readonly TotalAmount?: string;
  readonly AvailableAmount?: string;
  readonly Unit?: string;
  readonly Status?: string;
  readonly EffectiveTime?: string;
  readonly ExpiryTime?: string;
}

/** All statuses returned by billing ListResourcePackages. */
export const VOLCANO_RESOURCE_PACKAGE_STATUS = {
  NotEffective: "NotEffective",
  Effective: "Effective",
  FailedToCreate: "FailedToCreate",
  UsedUp: "UsedUp",
  Expired: "Expired",
  Refunded: "Refunded",
} as const;

export type VolcanoResourcePackageStatus =
  (typeof VOLCANO_RESOURCE_PACKAGE_STATUS)[keyof typeof VOLCANO_RESOURCE_PACKAGE_STATUS];

/** Statuses that contribute to usage meters (quota / remaining / used / expired). */
export const VOLCANO_USAGE_COUNTABLE_STATUSES = [
  VOLCANO_RESOURCE_PACKAGE_STATUS.Effective,
  VOLCANO_RESOURCE_PACKAGE_STATUS.UsedUp,
  VOLCANO_RESOURCE_PACKAGE_STATUS.Expired,
] as const;

/** @deprecated Use VOLCANO_USAGE_COUNTABLE_STATUSES */
export const VOLCANO_USAGE_PACKAGE_STATUSES = VOLCANO_USAGE_COUNTABLE_STATUSES;

export type VolcanoUsagePackageStatus =
  (typeof VOLCANO_USAGE_COUNTABLE_STATUSES)[number];

export function parseVolcanoPackageAmount(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isUsageCountableResourcePackage(
  row: VolcanoResourcePackageRow
): boolean {
  const status = row.Status;
  if (!status) return false;
  return (VOLCANO_USAGE_COUNTABLE_STATUSES as readonly string[]).includes(status);
}

export function isEffectiveResourcePackage(
  row: VolcanoResourcePackageRow
): boolean {
  return row.Status === VOLCANO_RESOURCE_PACKAGE_STATUS.Effective;
}

function mapPackageUnit(unit: string | undefined): VolcanoModelUsage["unit"] {
  if (unit === "张") return "images";
  return "tokens";
}

export interface VolcanoPackageStatusBreakdown {
  readonly effectiveCount: number;
  readonly usedUpCount: number;
  readonly expiredCount: number;
  readonly effectiveRemaining: number;
  readonly usedUpConsumed: number;
  readonly expiredUnused: number;
}

export interface AggregatedResourcePackageUsage {
  readonly used: number;
  readonly remaining: number;
  /** Unused amount forfeited at expiry (sum of Expired AvailableAmount). */
  readonly expired: number;
  readonly quota: number;
  readonly unit: VolcanoModelUsage["unit"];
  readonly usagePercent: number;
  readonly overQuota: boolean;
  readonly packageStatus: VolcanoPackageStatusBreakdown;
}

function sumPackageFieldByStatus(
  rows: readonly VolcanoResourcePackageRow[],
  status: VolcanoUsagePackageStatus,
  field: "TotalAmount" | "AvailableAmount"
): number {
  let sum = 0;
  for (const row of rows) {
    if (row.Status !== status) continue;
    sum += parseVolcanoPackageAmount(row[field]);
  }
  return sum;
}

function countPackagesByStatus(
  rows: readonly VolcanoResourcePackageRow[],
  status: VolcanoUsagePackageStatus
): number {
  let count = 0;
  for (const row of rows) {
    if (row.Status === status) count += 1;
  }
  return count;
}

/**
 * Aggregates billing resource package rows into usage meters.
 *
 * - quota = Σ Effective.TotalAmount + Σ UsedUp.TotalAmount + Σ Expired.TotalAmount
 * - remaining = Σ Effective.AvailableAmount
 * - expired = Σ Expired.AvailableAmount
 * - used = quota - remaining - expired
 */
export function aggregateResourcePackageRows(
  rows: readonly VolcanoResourcePackageRow[]
): { usage: AggregatedResourcePackageUsage | null; error?: string } {
  const usageRows = rows.filter(isUsageCountableResourcePackage);
  if (usageRows.length === 0) {
    return { usage: null };
  }

  const units = new Set(
    usageRows.map((row) => row.Unit).filter((unit): unit is string => Boolean(unit))
  );
  if (units.size !== 1) {
    return { usage: null, error: "Mixed resource package units" };
  }

  const effective = VOLCANO_RESOURCE_PACKAGE_STATUS.Effective;
  const usedUp = VOLCANO_RESOURCE_PACKAGE_STATUS.UsedUp;
  const expiredStatus = VOLCANO_RESOURCE_PACKAGE_STATUS.Expired;

  const quota =
    sumPackageFieldByStatus(usageRows, effective, "TotalAmount") +
    sumPackageFieldByStatus(usageRows, usedUp, "TotalAmount") +
    sumPackageFieldByStatus(usageRows, expiredStatus, "TotalAmount");

  const remaining = sumPackageFieldByStatus(usageRows, effective, "AvailableAmount");
  const expired = sumPackageFieldByStatus(usageRows, expiredStatus, "AvailableAmount");
  const used = Math.max(0, quota - remaining - expired);

  const effectiveRemaining = remaining;
  const usedUpConsumed = sumPackageFieldByStatus(usageRows, usedUp, "TotalAmount");
  const expiredUnused = expired;

  const usagePercent =
    quota > 0
      ? Math.max(0, Math.min(100, Math.round((remaining / quota) * 100)))
      : 0;

  return {
    usage: {
      used,
      remaining,
      expired,
      quota,
      unit: mapPackageUnit(usageRows[0]?.Unit),
      usagePercent,
      overQuota: quota > 0 && remaining <= 0,
      packageStatus: {
        effectiveCount: countPackagesByStatus(usageRows, effective),
        usedUpCount: countPackagesByStatus(usageRows, usedUp),
        expiredCount: countPackagesByStatus(usageRows, expiredStatus),
        effectiveRemaining,
        usedUpConsumed,
        expiredUnused,
      },
    },
  };
}

export interface UsageBarSegments {
  readonly usedPercent: number;
  readonly remainPercent: number;
  readonly expiredPercent: number;
}

function normalizeBarSegmentPercents(segments: UsageBarSegments): UsageBarSegments {
  const sum =
    segments.usedPercent + segments.remainPercent + segments.expiredPercent;
  if (sum === 100 || sum === 0) {
    return segments;
  }

  return {
    ...segments,
    usedPercent: segments.usedPercent + (100 - sum),
  };
}

export function computeUsageBarSegments(
  usage: Pick<
    AggregatedResourcePackageUsage,
    "used" | "remaining" | "expired" | "quota"
  >
): UsageBarSegments {
  if (usage.quota <= 0) {
    return { usedPercent: 0, remainPercent: 0, expiredPercent: 0 };
  }

  return normalizeBarSegmentPercents({
    usedPercent: Math.round((usage.used / usage.quota) * 100),
    remainPercent: Math.round((usage.remaining / usage.quota) * 100),
    expiredPercent: Math.round((usage.expired / usage.quota) * 100),
  });
}

export function resourcePackageRowKey(row: VolcanoResourcePackageRow): string {
  const instanceNo = row.InstanceNo?.trim();
  if (instanceNo) return instanceNo;

  return [
    row.ConfigurationCode ?? "",
    row.Status ?? "",
    row.TotalAmount ?? "",
    row.AvailableAmount ?? "",
    row.EffectiveTime ?? "",
  ].join(":");
}

/** Dedup key: prefer InstanceNo; rows without it use the full composite key. */
export function resourcePackageInstanceKey(
  row: VolcanoResourcePackageRow
): string {
  return resourcePackageRowKey(row);
}

const PACKAGE_STATUS_MERGE_PRIORITY: Readonly<Record<string, number>> = {
  [VOLCANO_RESOURCE_PACKAGE_STATUS.Expired]: 50,
  [VOLCANO_RESOURCE_PACKAGE_STATUS.UsedUp]: 40,
  [VOLCANO_RESOURCE_PACKAGE_STATUS.Effective]: 30,
  [VOLCANO_RESOURCE_PACKAGE_STATUS.NotEffective]: 20,
  [VOLCANO_RESOURCE_PACKAGE_STATUS.Refunded]: 10,
  [VOLCANO_RESOURCE_PACKAGE_STATUS.FailedToCreate]: 0,
};

function packageStatusMergePriority(status: string | undefined): number {
  if (!status) return -1;
  return PACKAGE_STATUS_MERGE_PRIORITY[status] ?? 0;
}

/**
 * Merges rows from multiple ListResourcePackages status passes.
 * Same InstanceNo keeps the row with the most terminal status (Expired > UsedUp > Effective).
 */
export function mergeVolcanoResourcePackagesByInstance(
  rows: readonly VolcanoResourcePackageRow[]
): VolcanoResourcePackageRow[] {
  const byKey = new Map<string, VolcanoResourcePackageRow>();

  for (const row of rows) {
    const key = resourcePackageInstanceKey(row);
    const existing = byKey.get(key);
    if (
      !existing ||
      packageStatusMergePriority(row.Status) >
        packageStatusMergePriority(existing.Status)
    ) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()];
}

/** Statuses to query — billing API omits UsedUp/Expired unless Status is set. */
export const VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES = [
  VOLCANO_RESOURCE_PACKAGE_STATUS.Effective,
  VOLCANO_RESOURCE_PACKAGE_STATUS.UsedUp,
  VOLCANO_RESOURCE_PACKAGE_STATUS.Expired,
] as const;

/** Optional statuses for diagnostics; not used in usage meters. */
export const VOLCANO_RESOURCE_PACKAGE_EXTENDED_STATUSES = [
  VOLCANO_RESOURCE_PACKAGE_STATUS.NotEffective,
  VOLCANO_RESOURCE_PACKAGE_STATUS.Refunded,
  VOLCANO_RESOURCE_PACKAGE_STATUS.FailedToCreate,
] as const;

/** @deprecated Use VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES for snapshots */
export const VOLCANO_RESOURCE_PACKAGE_LIST_STATUSES = [
  ...VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES,
  ...VOLCANO_RESOURCE_PACKAGE_EXTENDED_STATUSES,
] as const;

export type VolcanoResourcePackageFetchMode = "metering" | "full";

export function volcanoResourcePackageStatusesForMode(
  mode: VolcanoResourcePackageFetchMode
): readonly VolcanoResourcePackageStatus[] {
  if (mode === "full") {
    return VOLCANO_RESOURCE_PACKAGE_LIST_STATUSES;
  }
  return VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES;
}
