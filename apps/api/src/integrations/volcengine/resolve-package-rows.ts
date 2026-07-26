import {

  appendPackageListRefreshLog,

  buildVolcanoPackageUsageMap,

  evaluatePackageListRefreshRateLimit,

} from "@dafthunk/types";

import type {

  VolcanoInterfaceMetadata,

  VolcanoModelPackageSnapshot,

  VolcanoModelUsage,

} from "@dafthunk/types";

import { VOLCANO_AGGREGATE_MODEL_CATALOG } from "@dafthunk/types";



import { fetchVolcanoResourcePackages } from "./list-resource-packages";

import {

  buildPackageListCache,

  readPackageListCache,

  withPackageListCache,

} from "./package-list-cache";

import type { VolcanoResourcePackageRow } from "./parse-resource-packages";

import { indexResourcePackagesByConfigurationCode } from "./parse-resource-packages";



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

  refreshLimited?: boolean;

  nextRefreshAt?: string;

}> {

  const cached = readPackageListCache(params.metadata);



  if (params.refreshPackages) {

    const rateLimit = evaluatePackageListRefreshRateLimit(params.metadata);

    if (!rateLimit.allowed) {

      return {

        rows: cached ? [...cached.rows] : [],

        packageListCachedAt: cached?.fetchedAt,

        refreshLimited: true,

        nextRefreshAt: rateLimit.nextAllowedAt,

      };

    }

  } else if (cached) {

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



    const fetchedAt = new Date().toISOString();

    const withCache = withPackageListCache(

      params.metadata,

      buildPackageListCache({

        mode: "metering",

        rows: fetched.rows,

        statusCounts: fetched.statusCounts,

        fetchedAt,

      })

    );

    const nextMetadata = params.refreshPackages

      ? appendPackageListRefreshLog(withCache, fetchedAt)

      : withCache;



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

    catalog: VOLCANO_AGGREGATE_MODEL_CATALOG,

    packagesByCode,

  });

  return {

    usageByModel: aggregated.usageByCanonicalId,

    packageByModel: aggregated.packageByCanonicalId,

  };

}


