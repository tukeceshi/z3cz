import type { AiModelCatalogEntry } from "./ai-model-catalog";
import type {
  VolcanoModelPackageSnapshot,
  VolcanoModelUsage,
} from "./volcano-snapshot";
import type { VolcanoResourcePackageRow } from "./volcano-resource-package-usage";
import { volcanoPackageCodesForCanonicalId } from "./volcano-package-catalog";
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

export function buildVolcanoPackageSnapshotForModel(params: {
  readonly canonicalId: string;
  readonly packagesByCode: ReadonlyMap<string, readonly VolcanoResourcePackageRow[]>;
}): VolcanoModelPackageSnapshot {
  const codes = volcanoPackageCodesForCanonicalId(params.canonicalId);
  const matchedCodes: string[] = [];
  const instanceNos: string[] = [];
  const configurationNames: string[] = [];
  const matchedRows: VolcanoResourcePackageRow[] = [];

  for (const code of codes) {
    const rows = params.packagesByCode.get(code) ?? [];
    if (rows.length === 0) continue;

    matchedCodes.push(code);
    for (const row of rows) {
      matchedRows.push(row);
      if (row.InstanceNo) instanceNos.push(row.InstanceNo);
      if (row.ConfigurationName) configurationNames.push(row.ConfigurationName);
    }
  }

  return {
    provisioned: matchedRows.some(isUsageCountableResourcePackage),
    matchedCodes,
    instanceNos,
    configurationNames,
  };
}

export function buildVolcanoPackageUsageMap(params: {
  readonly catalog: readonly AiModelCatalogEntry[];
  readonly packagesByCode: ReadonlyMap<string, readonly VolcanoResourcePackageRow[]>;
}): {
  usageByCanonicalId: Map<string, VolcanoModelUsage | null>;
  packageByCanonicalId: Map<string, VolcanoModelPackageSnapshot>;
  usageErrorsByCanonicalId: Map<string, string>;
} {
  const usageByCanonicalId = new Map<string, VolcanoModelUsage | null>();
  const packageByCanonicalId = new Map<string, VolcanoModelPackageSnapshot>();
  const usageErrorsByCanonicalId = new Map<string, string>();

  for (const entry of params.catalog) {
    const packageSnapshot = buildVolcanoPackageSnapshotForModel({
      canonicalId: entry.canonicalId,
      packagesByCode: params.packagesByCode,
    });
    packageByCanonicalId.set(entry.canonicalId, packageSnapshot);

    const codes = volcanoPackageCodesForCanonicalId(entry.canonicalId);
    if (codes.length === 0) {
      usageByCanonicalId.set(entry.canonicalId, null);
      continue;
    }

    const matchedRows: VolcanoResourcePackageRow[] = [];
    for (const code of codes) {
      matchedRows.push(...(params.packagesByCode.get(code) ?? []));
    }

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
