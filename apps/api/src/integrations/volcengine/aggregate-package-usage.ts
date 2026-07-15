import type {
  AiModelCatalogEntry,
  VolcanoModelPackageSnapshot,
  VolcanoModelUsage,
} from "@dafthunk/types";
import {
  aggregateResourcePackageRows,
  isUsageCountableResourcePackage,
  volcanoPackageCodesForCanonicalId,
} from "@dafthunk/types";

import type { VolcanoResourcePackageRow } from "./parse-resource-packages";

export function buildVolcanoPackageSnapshotForModel(params: {
  canonicalId: string;
  packagesByCode: ReadonlyMap<string, readonly VolcanoResourcePackageRow[]>;
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
  catalog: readonly AiModelCatalogEntry[];
  packagesByCode: ReadonlyMap<string, readonly VolcanoResourcePackageRow[]>;
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
