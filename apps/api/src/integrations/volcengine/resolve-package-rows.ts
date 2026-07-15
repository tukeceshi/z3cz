import { buildVolcanoPackageUsageMap } from "./aggregate-package-usage";
import { fetchVolcanoResourcePackages } from "./list-resource-packages";
import {
  buildPackageListCache,
  isPackageListCacheFresh,
  readPackageListCache,
  withPackageListCache,
} from "./package-list-cache";
import type { VolcanoResourcePackageRow } from "./parse-resource-packages";
import { indexResourcePackagesByConfigurationCode } from "./parse-resource-packages";

import {
  VOLCANO_AI_MODEL_CATALOG,
  type VolcanoInterfaceMetadata,
  type VolcanoModelPackageSnapshot,
  type VolcanoModelUsage,
} from "@dafthunk/types";

import type { VolcengineCredentials } from "./client";

function formatPartialPackageFetchError(errors: readonly string[]): string {
  return `Resource package data may be incomplete: ${errors.join("; ")}`;
}

export async function resolveVolcanoPackageRows(params: {
  credentials: VolcengineCredentials;
  metadata: VolcanoInterfaceMetadata;
  refreshPackages: boolean;
  onMetadataCacheUpdate?: (metadata: VolcanoInterfaceMetadata) => Promise<void>;
}): Promise<{
  rows: VolcanoResourcePackageRow[];
  usageFetchError?: string;
  packageListCachedAt?: string;
}> {
  const cached = readPackageListCache(params.metadata);
  const cacheIsFresh = cached ? isPackageListCacheFresh(cached) : false;

  if (!params.refreshPackages && cacheIsFresh && cached) {
    return {
      rows: [...cached.rows],
      packageListCachedAt: cached.fetchedAt,
    };
  }

  try {
    const fetched = await fetchVolcanoResourcePackages({
      credentials: params.credentials,
      mode: "metering",
    });

    const nextMetadata = withPackageListCache(
      params.metadata,
      buildPackageListCache({
        mode: "metering",
        rows: fetched.rows,
        statusCounts: fetched.statusCounts,
      })
    );

    if (params.onMetadataCacheUpdate) {
      await params.onMetadataCacheUpdate(nextMetadata);
    }

    const usageFetchError =
      fetched.partialErrors.length > 0
        ? formatPartialPackageFetchError(fetched.partialErrors)
        : undefined;

    return {
      rows: fetched.rows,
      usageFetchError,
      packageListCachedAt: nextMetadata.packageListCache?.fetchedAt,
    };
  } catch (error) {
    if (cached) {
      const staleMessage =
        error instanceof Error ? error.message : "Failed to fetch resource packages";
      return {
        rows: [...cached.rows],
        usageFetchError: `Using cached package data (${staleMessage})`,
        packageListCachedAt: cached.fetchedAt,
      };
    }
    throw error;
  }
}

export function buildUsageMapsFromPackageRows(
  packages: readonly VolcanoResourcePackageRow[]
): {
  usageByModel: Map<string, VolcanoModelUsage | null>;
  packageByModel: Map<string, VolcanoModelPackageSnapshot>;
} {
  const packagesByCode = indexResourcePackagesByConfigurationCode(packages);
  const aggregated = buildVolcanoPackageUsageMap({
    catalog: VOLCANO_AI_MODEL_CATALOG,
    packagesByCode,
  });
  return {
    usageByModel: aggregated.usageByCanonicalId,
    packageByModel: aggregated.packageByCanonicalId,
  };
}
