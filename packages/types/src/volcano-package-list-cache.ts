import type { VolcanoInterfaceMetadata, VolcanoPackageListCache } from "./volcano-snapshot";

export const VOLCANO_PACKAGE_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
/** Auto-fetch package list on panel expand when cache is older than this. */
export const VOLCANO_PACKAGE_LIST_EXPAND_AUTO_REFRESH_MS = 30 * 60 * 1000;

/** Minimum gap between successful billing package fetches (server + client real refresh). */
export const VOLCANO_PACKAGE_LIST_REFRESH_MIN_INTERVAL_MS = 60 * 1000;

/** Rolling window for counting billing package fetches (server). */
export const VOLCANO_PACKAGE_LIST_REFRESH_WINDOW_MS = 10 * 60 * 1000;

export const VOLCANO_PACKAGE_LIST_REFRESH_MAX_PER_WINDOW = 3;

export interface PackageListRefreshRateLimitResult {
  readonly allowed: boolean;
  readonly nextAllowedAt?: string;
  readonly reason?: "min_interval" | "window_exhausted";
}

export function isPackageListCacheFresh(
  cache: VolcanoPackageListCache,
  nowMs: number = Date.now()
): boolean {
  const fetchedAt = Date.parse(cache.fetchedAt);
  if (Number.isNaN(fetchedAt)) {
    return false;
  }
  return nowMs - fetchedAt < VOLCANO_PACKAGE_LIST_CACHE_TTL_MS;
}

export function shouldAutoRefreshPackageListOnExpand(
  cache: VolcanoPackageListCache,
  nowMs: number = Date.now()
): boolean {
  const fetchedAt = Date.parse(cache.fetchedAt);
  if (Number.isNaN(fetchedAt)) {
    return true;
  }
  return nowMs - fetchedAt >= VOLCANO_PACKAGE_LIST_EXPAND_AUTO_REFRESH_MS;
}

export function readPackageListCache(
  metadata: VolcanoInterfaceMetadata | null | undefined
): VolcanoPackageListCache | null {
  if (!metadata?.packageListCache || !Array.isArray(metadata.packageListCache.rows)) {
    return null;
  }
  return metadata.packageListCache;
}

export function readPackageListRefreshLog(
  metadata: VolcanoInterfaceMetadata | null | undefined
): readonly string[] {
  const log = metadata?.packageListRefreshLog;
  if (!Array.isArray(log)) {
    return [];
  }
  return log.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );
}

export function prunePackageListRefreshLog(
  log: readonly string[],
  nowMs: number = Date.now()
): readonly string[] {
  const windowStart = nowMs - VOLCANO_PACKAGE_LIST_REFRESH_WINDOW_MS;
  return log.filter((entry) => {
    const parsed = Date.parse(entry);
    return !Number.isNaN(parsed) && parsed >= windowStart;
  });
}

export function evaluatePackageListRefreshRateLimit(
  metadata: VolcanoInterfaceMetadata | null | undefined,
  nowMs: number = Date.now()
): PackageListRefreshRateLimitResult {
  const pruned = prunePackageListRefreshLog(
    readPackageListRefreshLog(metadata),
    nowMs
  );

  if (pruned.length >= VOLCANO_PACKAGE_LIST_REFRESH_MAX_PER_WINDOW) {
    const oldest = Math.min(...pruned.map((entry) => Date.parse(entry)));
    return {
      allowed: false,
      reason: "window_exhausted",
      nextAllowedAt: new Date(
        oldest + VOLCANO_PACKAGE_LIST_REFRESH_WINDOW_MS
      ).toISOString(),
    };
  }

  if (pruned.length > 0) {
    const last = Math.max(...pruned.map((entry) => Date.parse(entry)));
    const nextByInterval = last + VOLCANO_PACKAGE_LIST_REFRESH_MIN_INTERVAL_MS;
    if (nowMs < nextByInterval) {
      return {
        allowed: false,
        reason: "min_interval",
        nextAllowedAt: new Date(nextByInterval).toISOString(),
      };
    }
  }

  return { allowed: true };
}

export function canClientTriggerRealPackageRefresh(
  lastRealRefreshAtMs: number | null,
  nowMs: number = Date.now()
): boolean {
  if (lastRealRefreshAtMs === null) {
    return true;
  }
  return (
    nowMs - lastRealRefreshAtMs >= VOLCANO_PACKAGE_LIST_REFRESH_MIN_INTERVAL_MS
  );
}

export function appendPackageListRefreshLog(
  metadata: VolcanoInterfaceMetadata,
  refreshedAt: string = new Date().toISOString()
): VolcanoInterfaceMetadata {
  const pruned = prunePackageListRefreshLog(readPackageListRefreshLog(metadata));
  return {
    ...metadata,
    packageListRefreshLog: [...pruned, refreshedAt],
  };
}

export function getPackageListNextRefreshAt(
  cache: VolcanoPackageListCache
): string {
  const fetchedAt = Date.parse(cache.fetchedAt);
  if (Number.isNaN(fetchedAt)) {
    return new Date(Date.now() + VOLCANO_PACKAGE_LIST_CACHE_TTL_MS).toISOString();
  }
  return new Date(fetchedAt + VOLCANO_PACKAGE_LIST_CACHE_TTL_MS).toISOString();
}

export function getPackageListRefreshCooldownMs(
  cache: VolcanoPackageListCache,
  nowMs: number = Date.now()
): number {
  const nextAt = Date.parse(getPackageListNextRefreshAt(cache));
  if (Number.isNaN(nextAt)) {
    return 0;
  }
  return Math.max(0, nextAt - nowMs);
}
