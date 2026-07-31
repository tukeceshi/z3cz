import type { AiModelCatalogEntry } from "./ai-model-catalog";
import type {
  VolcanoModelPackageSnapshot,
  VolcanoModelUsage,
} from "./volcano-snapshot";
import type { VolcanoResourcePackageRow } from "./volcano-resource-package-usage";
import {
  pickVolcanoPackageOwnerCanonicalId,
} from "./volcano-package-catalog";
import {
  aggregateResourcePackageRows,
  isUsageCountableResourcePackage,
} from "./volcano-resource-package-usage";

function indexResourcePackagesByConfigurationCode(
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

function collectRowsForCanonicalId(params: {
  readonly canonicalId: string;
  readonly catalogCanonicalIds: readonly string[];
  readonly packagesByCode: ReadonlyMap<
    string,
    readonly VolcanoResourcePackageRow[]
  >;
}): VolcanoResourcePackageRow[] {
  const matchedRows: VolcanoResourcePackageRow[] = [];

  for (const [code, rows] of params.packagesByCode) {
    const owner = pickVolcanoPackageOwnerCanonicalId(
      code,
      params.catalogCanonicalIds
    );
    if (owner !== params.canonicalId) {
      continue;
    }
    matchedRows.push(...rows);
  }

  return matchedRows;
}

function snapshotFromRows(
  matchedRows: readonly VolcanoResourcePackageRow[]
): VolcanoModelPackageSnapshot {
  const matchedCodes: string[] = [];
  const instanceNos: string[] = [];
  const configurationNames: string[] = [];
  const seenCodes = new Set<string>();

  for (const row of matchedRows) {
    const code = row.ConfigurationCode?.trim();
    if (code && !seenCodes.has(code)) {
      seenCodes.add(code);
      matchedCodes.push(code);
    }
    if (row.InstanceNo) instanceNos.push(row.InstanceNo);
    if (row.ConfigurationName) configurationNames.push(row.ConfigurationName);
  }

  return {
    provisioned: matchedRows.some(isUsageCountableResourcePackage),
    matchedCodes,
    instanceNos,
    configurationNames,
  };
}

export function buildVolcanoPackageSnapshotForModel(params: {
  readonly canonicalId: string;
  readonly packagesByCode: ReadonlyMap<
    string,
    readonly VolcanoResourcePackageRow[]
  >;
  /** Defaults to `[canonicalId]` when omitted (single-model lookup). */
  readonly catalogCanonicalIds?: readonly string[];
}): VolcanoModelPackageSnapshot {
  const catalogCanonicalIds =
    params.catalogCanonicalIds ?? [params.canonicalId];
  return snapshotFromRows(
    collectRowsForCanonicalId({
      canonicalId: params.canonicalId,
      catalogCanonicalIds,
      packagesByCode: params.packagesByCode,
    })
  );
}

export function buildVolcanoPackageUsageMap(params: {
  readonly catalog: readonly AiModelCatalogEntry[];
  readonly packagesByCode: ReadonlyMap<
    string,
    readonly VolcanoResourcePackageRow[]
  >;
}): {
  usageByCanonicalId: Map<string, VolcanoModelUsage | null>;
  packageByCanonicalId: Map<string, VolcanoModelPackageSnapshot>;
  usageErrorsByCanonicalId: Map<string, string>;
} {
  const usageByCanonicalId = new Map<string, VolcanoModelUsage | null>();
  const packageByCanonicalId = new Map<string, VolcanoModelPackageSnapshot>();
  const usageErrorsByCanonicalId = new Map<string, string>();
  const catalogCanonicalIds = params.catalog.map((entry) => entry.canonicalId);

  for (const entry of params.catalog) {
    const matchedRows = collectRowsForCanonicalId({
      canonicalId: entry.canonicalId,
      catalogCanonicalIds,
      packagesByCode: params.packagesByCode,
    });
    const packageSnapshot = snapshotFromRows(matchedRows);
    packageByCanonicalId.set(entry.canonicalId, packageSnapshot);

    const { usage, error } = aggregateResourcePackageRows(matchedRows);
    usageByCanonicalId.set(
      entry.canonicalId,
      usage
        ? {
            ...usage,
            period: "package",
          }
        : null
    );
    if (error) {
      usageErrorsByCanonicalId.set(entry.canonicalId, error);
    }
  }

  return {
    usageByCanonicalId,
    packageByCanonicalId,
    usageErrorsByCanonicalId,
  };
}

export function buildUsageMapsFromPackageRows(
  packages: readonly VolcanoResourcePackageRow[],
  catalog: readonly AiModelCatalogEntry[]
): {
  usageByModel: Map<string, VolcanoModelUsage | null>;
  packageByModel: Map<string, VolcanoModelPackageSnapshot>;
} {
  const packagesByCode = indexResourcePackagesByConfigurationCode(packages);
  const aggregated = buildVolcanoPackageUsageMap({
    catalog,
    packagesByCode,
  });
  return {
    usageByModel: aggregated.usageByCanonicalId,
    packageByModel: aggregated.packageByCanonicalId,
  };
}
