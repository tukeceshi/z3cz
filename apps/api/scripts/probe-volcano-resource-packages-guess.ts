/**
 * Guess additional resource package action names on ark.
 */
import { callVolcengineArkApi } from "../src/integrations/volcengine/client";

const ACTIONS = [
  "ListResourcePackages",
  "ListArkResourcePackages",
  "ListInferencePackages",
  "ListTokenPackages",
  "ListFreeQuotas",
  "ListModelFreeQuotas",
  "ListInferenceFreeQuotas",
  "ListAccountResourcePackages",
  "ListUserResourcePackages",
  "ListPackageInstances",
  "ListInferencePackageInstances",
  "DescribeResourcePackages",
  "GetResourcePackageBalance",
  "ListResourcePackageBalance",
  "ListInferenceResourcePackageBalance",
  "ListModelInferencePackages",
  "ListFoundationModelResourcePackages",
] as const;

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const credentials = {
    accessKeyId: process.env.VOLC_AK!,
    secretAccessKey: process.env.VOLC_SK!,
    region: "cn-beijing",
  };

  const body = { PageNumber: 1, PageSize: 50 };

  for (const action of ACTIONS) {
    try {
      const result = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action,
        body,
      });
      console.log(`OK ${action}`);
      console.log(JSON.stringify(result, null, 2).slice(0, 2000));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Could not find operation")) {
        console.log(`INTERESTING ${action}: ${message}`);
      }
    }
  }
}

void main();
