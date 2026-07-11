import type {

  AiModelCatalogEntry,

  VolcanoModelPackageSnapshot,

  VolcanoModelUsage,

} from "@dafthunk/types";

import { volcanoPackageCodesForCanonicalId } from "@dafthunk/types";



import {

  indexResourcePackagesByConfigurationCode,

  isEffectiveResourcePackage,

  isUsageCountableResourcePackage,

  parsePackageAmount,

  type VolcanoResourcePackageRow,

} from "./parse-resource-packages";



function mapPackageUnit(unit: string | undefined): VolcanoModelUsage["unit"] {

  if (unit === "张") return "images";

  return "tokens";

}



function buildPackageUsage(

  rows: readonly VolcanoResourcePackageRow[]

): { usage: VolcanoModelUsage | null; error?: string } {

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



  let quota = 0;

  let remaining = 0;

  let expired = 0;



  for (const row of usageRows) {

    const total = parsePackageAmount(row.TotalAmount);

    const available = parsePackageAmount(row.AvailableAmount);

    quota += total;



    if (row.Status === "Effective") {

      remaining += available;

      continue;

    }



    if (row.Status === "Expired") {

      expired += available;

    }

  }



  const used = Math.max(0, quota - remaining - expired);
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
      period: "package",
      usagePercent,
      overQuota: quota > 0 && remaining <= 0,
    },
  };
}



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



  const effectiveRows = matchedRows.filter(isEffectiveResourcePackage);



  return {

    provisioned: effectiveRows.length > 0,

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



    const { usage, error } = buildPackageUsage(matchedRows);

    usageByCanonicalId.set(entry.canonicalId, usage);

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


