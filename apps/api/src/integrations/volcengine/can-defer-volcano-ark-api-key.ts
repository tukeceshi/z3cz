import {
  VOLCANO_AGGREGATE_MODEL_CATALOG,
  type AiModelCatalogEntry,
} from "@dafthunk/types";

import type { VolcengineCredentials } from "./client";
import { buildVolcanoPackageUsageMap } from "./aggregate-package-usage";
import { fetchVolcanoResourcePackages } from "./list-resource-packages";
import { indexResourcePackagesByConfigurationCode } from "./parse-resource-packages";
import { hasProvisionedVolcanoPackageModels } from "./resolve-volcano-activation";

export async function canDeferVolcanoArkApiKey(params: {
  readonly credentials: VolcengineCredentials;
  readonly catalog?: readonly AiModelCatalogEntry[];
}): Promise<boolean> {
  const catalog = params.catalog ?? VOLCANO_AGGREGATE_MODEL_CATALOG;

  const packageFetch = await fetchVolcanoResourcePackages({
    credentials: params.credentials,
    mode: "metering",
  }).catch(() => null);

  if (!packageFetch) {
    return false;
  }

  const packagesByCode = indexResourcePackagesByConfigurationCode(
    packageFetch.rows
  );
  const { packageByCanonicalId } = buildVolcanoPackageUsageMap({
    catalog,
    packagesByCode,
  });

  return hasProvisionedVolcanoPackageModels(packageByCanonicalId);
}
