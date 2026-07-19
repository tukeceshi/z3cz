import {
  VOLCANO_TOS_DEFAULT_PREFIX,
  type VolcanoInterfaceMetadata,
  type VolcanoResourcePackageRow,
  type VolcanoTosStorageSnapshot,
  volcanoTosPricingForRegion,
} from "@dafthunk/types";

import { buildTosPackageUsageFromRows } from "./tos-package-usage";

export function buildVolcanoTosStorageSnapshot(params: {
  readonly metadata: VolcanoInterfaceMetadata;
  readonly packageRows: readonly VolcanoResourcePackageRow[];
  readonly usageError?: string;
}): VolcanoTosStorageSnapshot {
  const config = params.metadata.tosStorage;
  const region = config?.region?.trim() ?? "";
  const bucket = config?.bucket?.trim() ?? "";
  const configured = Boolean(region && bucket);
  const enabled = config?.enabled === true && configured;

  const { storageUsage, trafficUsage } = buildTosPackageUsageFromRows(
    params.packageRows
  );

  const pricingRegion = region;
  const pricing = pricingRegion
    ? volcanoTosPricingForRegion(pricingRegion)
    : undefined;

  return {
    enabled,
    configured,
    region,
    bucket,
    prefix: VOLCANO_TOS_DEFAULT_PREFIX,
    storageUsage,
    trafficUsage,
    pricing: pricing ?? undefined,
    ...(params.usageError ? { usageError: params.usageError } : {}),
  };
}
