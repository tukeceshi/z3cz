/**
 * Paginate billing ListResourcePackages and map to VOLCANO_AI_MODEL_CATALOG.
 */
import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

interface PackageRow {
  readonly InstanceNo?: string;
  readonly ConfigurationCode?: string;
  readonly ConfigurationName?: string;
  readonly TotalAmount?: string;
  readonly AvailableAmount?: string;
  readonly Unit?: string;
  readonly Status?: string;
  readonly PackageType?: string;
  readonly Product?: string;
}

const CATALOG_CONFIG_MAP: Readonly<Record<string, string>> = {
  "deepseek-v4-pro": "DeepSeek_V4_pro_free_inference_resource_pack",
  "deepseek-v4-flash": "DeepSeek_V4_flash_free_inference_resource_pack",
  "glm-5-2": "GLM_5.2_free_inference_resource_pack",
  "doubao-seedance-2": "Doubao_Seedance_2.0_pack_free_infer",
  "doubao-seedance-2-fast": "Doubao_Seedance_2.0_fast_pack_free_infer",
  "doubao-seedance-2-mini": "Doubao_Seedance_2.0_mini_pack_free_infer",
  "doubao-seedream-5-pro": "Doubao_Seedream_5.0_pro_pack_free_infer",
  "doubao-seedream-5": "Doubao_Seedream_5.0_pack_free_infer",
};

async function fetchPage(nextToken?: string): Promise<{
  list: PackageRow[];
  nextToken: string | null;
}> {
  const body: Record<string, unknown> = {
    ResourceType: "Package",
    MaxResults: "20",
  };
  if (nextToken) body.NextToken = nextToken;

  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: "billing",
    host: "billing.volcengineapi.com",
    method: "POST",
    action: "ListResourcePackages",
    version: "2022-01-01",
    body,
  });
  const res = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await res.json()) as {
    ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
    Result?: { List?: PackageRow[]; NextToken?: string };
  };
  const err = payload.ResponseMetadata?.Error;
  if (err) throw new Error(`${err.Code}: ${err.Message}`);

  const result = payload.Result ?? {};
  const token = result.NextToken;
  return {
    list: result.List ?? [],
    nextToken: token && token !== "0" ? token : null,
  };
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const all: PackageRow[] = [];
  let token: string | null = null;
  let pages = 0;
  do {
    const page = await fetchPage(token ?? undefined);
    all.push(...page.list);
    token = page.nextToken;
    pages += 1;
  } while (token && pages < 10);

  console.log(`Total packages: ${all.length} (${pages} pages)`);

  const arkPackages = all.filter((p) => p.Product === "ark_bd");
  console.log(`ark_bd packages: ${arkPackages.length}`);

  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const expected = CATALOG_CONFIG_MAP[entry.canonicalId];
    const match = expected
      ? arkPackages.find((p) => p.ConfigurationCode === expected)
      : arkPackages.find(
          (p) =>
            p.ConfigurationName?.toLowerCase().includes(entry.canonicalId) ||
            p.ConfigurationCode?.toLowerCase().includes(
              entry.canonicalId.replace(/-/g, "_")
            )
        );

    console.log(`\n--- ${entry.canonicalId} ---`);
    if (!match) {
      console.log("NO PACKAGE");
      if (expected) console.log(`expected ConfigurationCode: ${expected}`);
      continue;
    }
    console.log(JSON.stringify(match, null, 2));
    const total = Number(match.TotalAmount ?? 0);
    const avail = Number(match.AvailableAmount ?? 0);
    console.log(
      `used=${total - avail} remaining=${avail} quota=${total} unit=${match.Unit}`
    );
  }

  console.log("\n--- all ConfigurationCodes ---");
  for (const p of arkPackages) {
    console.log(
      `${p.ConfigurationCode}\t${p.Status}\t${p.AvailableAmount}/${p.TotalAmount}\t${p.Unit}`
    );
  }
}

void main();
