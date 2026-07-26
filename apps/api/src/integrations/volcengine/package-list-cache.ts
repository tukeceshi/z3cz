import type {
  VolcanoInterfaceMetadata,
  VolcanoPackageListCache,
  VolcanoResourcePackageFetchMode,
} from "@dafthunk/types";
import {
  isPackageListCacheFresh,
  readPackageListCache,
  VOLCANO_PACKAGE_LIST_CACHE_TTL_MS,
  getPackageListNextRefreshAt,
} from "@dafthunk/types";

import type { VolcanoResourcePackageRow } from "./parse-resource-packages";

export {
  isPackageListCacheFresh,
  readPackageListCache,
  VOLCANO_PACKAGE_LIST_CACHE_TTL_MS,
  getPackageListNextRefreshAt,
};

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
