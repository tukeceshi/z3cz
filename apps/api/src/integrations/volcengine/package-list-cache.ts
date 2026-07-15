import type {
  VolcanoInterfaceMetadata,
  VolcanoPackageListCache,
  VolcanoResourcePackageFetchMode,
} from "@dafthunk/types";
import type { VolcanoResourcePackageRow } from "./parse-resource-packages";

export const VOLCANO_PACKAGE_LIST_CACHE_TTL_MS = 10 * 60 * 1000;

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

export function readPackageListCache(
  metadata: VolcanoInterfaceMetadata
): VolcanoPackageListCache | null {
  const cache = metadata.packageListCache;
  if (!cache || !Array.isArray(cache.rows)) {
    return null;
  }
  return cache;
}

export function buildPackageListCache(params: {
  mode: VolcanoResourcePackageFetchMode;
  rows: readonly VolcanoResourcePackageRow[];
  statusCounts: Readonly<Record<string, number>>;
  fetchedAt?: string;
}): VolcanoPackageListCache {
  return {
    fetchedAt: params.fetchedAt ?? new Date().toISOString(),
    mode: params.mode,
    rows: params.rows,
    statusCounts: params.statusCounts,
  };
}

export function withPackageListCache(
  metadata: VolcanoInterfaceMetadata,
  cache: VolcanoPackageListCache
): VolcanoInterfaceMetadata {
  return {
    ...metadata,
    packageListCache: cache,
  };
}
