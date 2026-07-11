import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { buildVolcanoPackageUsageMap } from "../src/integrations/volcengine/aggregate-package-usage";
import { fetchAllVolcanoResourcePackages } from "../src/integrations/volcengine/list-resource-packages";
import { indexResourcePackagesByConfigurationCode } from "../src/integrations/volcengine/parse-resource-packages";

async function main(): Promise<void> {
  const accessKeyId = process.env.VOLC_AK;
  const secretAccessKey = process.env.VOLC_SK;

  if (!accessKeyId || !secretAccessKey) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const credentials = {
    accessKeyId,
    secretAccessKey,
    region: "cn-beijing",
  };

  const packages = await fetchAllVolcanoResourcePackages({
    credentials,
    status: "Effective",
  });
  console.log("Package count:", packages.length);

  const packagesByCode = indexResourcePackagesByConfigurationCode(packages);
  const { usageByCanonicalId, packageByCanonicalId } = buildVolcanoPackageUsageMap({
    catalog: VOLCANO_AI_MODEL_CATALOG,
    packagesByCode,
  });

  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const usage = usageByCanonicalId.get(entry.canonicalId);
    const pkg = packageByCanonicalId.get(entry.canonicalId);
    console.log(
      `${entry.canonicalId}: provisioned=${pkg?.provisioned} remaining=${usage?.remaining ?? "—"} quota=${usage?.quota ?? "—"}`
    );
  }

  console.log("\nListResourcePackages snapshot OK.");
}

void main();
