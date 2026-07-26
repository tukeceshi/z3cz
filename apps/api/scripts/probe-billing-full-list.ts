/**
 * Full ListResourcePackages pull + filter/query experiments.
 * Doc: https://docs.volcengine.com/docs/6269/1337079?lang=zh
 */
import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

interface PackageRow {
  readonly InstanceNo?: string;
  readonly InstanceName?: string;
  readonly ConfigurationCode?: string;
  readonly ConfigurationName?: string;
  readonly Product?: string;
  readonly ProductName?: string;
  readonly TotalAmount?: string;
  readonly AvailableAmount?: string;
  readonly Unit?: string;
  readonly Specification?: string;
  readonly SpecificationUnit?: string;
  readonly PackageType?: string;
  readonly Status?: string;
  readonly EffectiveTime?: string;
  readonly ExpiryTime?: string;
  readonly RegionCode?: string;
}

async function callListResourcePackages(
  body: Record<string, unknown>
): Promise<{ list: PackageRow[]; nextToken: string | null; error?: string }> {
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

  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await response.json()) as {
    ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
    Result?: { List?: PackageRow[]; NextToken?: string };
  };
  const err = payload.ResponseMetadata?.Error;
  if (err) {
    return { list: [], nextToken: null, error: `${err.Code}: ${err.Message}` };
  }
  const result = payload.Result ?? {};
  const token = result.NextToken;
  return {
    list: result.List ?? [],
    nextToken: token && token !== "0" ? token : null,
  };
}

async function fetchAllPackages(
  baseBody: Record<string, unknown>
): Promise<{ packages: PackageRow[]; pages: number; error?: string }> {
  const packages: PackageRow[] = [];
  let nextToken: string | null = null;
  let pages = 0;

  do {
    const body = { ...baseBody };
    if (nextToken) body.NextToken = nextToken;
    const page = await callListResourcePackages(body);
    if (page.error) {
      return { packages, pages, error: page.error };
    }
    packages.push(...page.list);
    nextToken = page.nextToken;
    pages += 1;
    if (nextToken) await new Promise((r) => setTimeout(r, 350));
  } while (nextToken && pages < 50);

  return { packages, pages };
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function aggregatePackages(rows: readonly PackageRow[]): {
  quota: number;
  remaining: number;
  used: number;
  unit: string | null;
  count: number;
} {
  if (rows.length === 0) {
    return { quota: 0, remaining: 0, used: 0, unit: null, count: 0 };
  }
  const units = new Set(rows.map((r) => r.Unit).filter(Boolean));
  const unit = units.size === 1 ? (rows[0]?.Unit ?? null) : "mixed";
  let quota = 0;
  let remaining = 0;
  for (const row of rows) {
    quota += parseAmount(row.TotalAmount);
    remaining += parseAmount(row.AvailableAmount);
  }
  return { quota, remaining, used: quota - remaining, unit, count: rows.length };
}

const SEARCH_TERMS: readonly string[] = [
  "seedance-2-mini",
  "seedance-2.0-mini",
  "Seedance-2.0-mini",
  "Seedance 2.0 mini",
  "doubao-seedance-2-0-mini",
  "mini",
  "seedream-5-pro",
  "Seedream-5.0-pro",
  "seedream-5",
  "deepseek-v4",
  "evolving",
  "ConfigurationName",
  "ModelName",
  "FoundationModelName",
];

async function testFilterVariants(): Promise<void> {
  console.log("\n######## FILTER / QUERY VARIANTS ########");

  const variants: Array<{ label: string; body: Record<string, unknown> }> = [
    { label: "base", body: { ResourceType: "Package", MaxResults: "20" } },
    {
      label: "Status=Effective",
      body: { ResourceType: "Package", MaxResults: "20", Status: "Effective" },
    },
    {
      label: "Product=ark_bd",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        Product: "ark_bd",
      },
    },
    {
      label: "Product=Doubao-Seedream",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        Product: "Doubao-Seedream",
      },
    },
    {
      label: "Product=Doubao-image-generation",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        Product: "Doubao-image-generation",
      },
    },
    {
      label: "ConfigurationName exact DeepSeek",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        ConfigurationName: "DeepSeek-V4-pro-免费在线推理资源包",
      },
    },
    {
      label: "ConfigurationName partial Seedance mini",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        ConfigurationName: "Seedance-2.0-mini",
      },
    },
    {
      label: "ConfigurationName partial mini",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        ConfigurationName: "mini",
      },
    },
    {
      label: "ModelName filter guess",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        ModelName: "doubao-seedance-2-0-mini-260615",
      },
    },
    {
      label: "FoundationModelName filter guess",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        FoundationModelName: "doubao-seedance-2-0-mini",
      },
    },
    {
      label: "Filter.ConfigurationName guess",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        Filter: { ConfigurationName: "mini" },
      },
    },
    {
      label: "Keyword guess",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        Keyword: "seedance mini",
      },
    },
    {
      label: "InstanceName guess",
      body: {
        ResourceType: "Package",
        MaxResults: "20",
        InstanceName: "mini",
      },
    },
  ];

  for (const variant of variants) {
    const { packages, pages, error } = await fetchAllPackages(variant.body);
    const seedanceMini = packages.filter((p) =>
      JSON.stringify(p).toLowerCase().includes("seedance") &&
      JSON.stringify(p).toLowerCase().includes("mini")
    );
    console.log(
      `\n[${variant.label}] pages=${pages} total=${packages.length} err=${error ?? "none"} seedance+mini=${seedanceMini.length}`
    );
    if (seedanceMini.length > 0) {
      for (const row of seedanceMini) {
        console.log(
          `  ${row.ConfigurationCode} | ${row.ConfigurationName} | ${row.AvailableAmount}/${row.TotalAmount} ${row.Unit}`
        );
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

function fuzzyMatchPackage(
  row: PackageRow,
  terms: readonly string[]
): boolean {
  const haystack = [
    row.ConfigurationCode,
    row.ConfigurationName,
    row.InstanceName,
    row.Product,
    row.ProductName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.some((t) => haystack.includes(t.toLowerCase()));
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  console.log("######## FULL LIST (ResourceType=Package) ########");
  const full = await fetchAllPackages({
    ResourceType: "Package",
    MaxResults: "20",
  });
  if (full.error) {
    console.error("FULL LIST ERROR:", full.error);
    return;
  }
  console.log(`pages=${full.pages} total=${full.packages.length}`);

  const byProduct = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const row of full.packages) {
    byProduct.set(row.Product ?? "(null)", (byProduct.get(row.Product ?? "(null)") ?? 0) + 1);
    byStatus.set(row.Status ?? "(null)", (byStatus.get(row.Status ?? "(null)") ?? 0) + 1);
  }
  console.log("\n--- By Product ---");
  for (const [k, v] of [...byProduct.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${k}: ${v}`);
  }
  console.log("\n--- By Status ---");
  for (const [k, v] of [...byStatus.entries()].sort()) {
    console.log(`${k}: ${v}`);
  }

  console.log("\n--- Full ark_bd + image/seed packages ---");
  for (const row of full.packages) {
    const code = row.ConfigurationCode ?? "";
    if (
      /ark_bd|seedream|seedance|deepseek|evolving|image-generation/i.test(
        `${row.Product} ${code} ${row.ConfigurationName}`
      )
    ) {
      console.log(
        [
          row.Status,
          row.Product,
          code,
          row.ConfigurationName,
          `${row.AvailableAmount}/${row.TotalAmount}`,
          row.Unit,
          row.InstanceNo,
        ].join("\t")
      );
    }
  }

  console.log("\n######## CATALOG MATCH (multi-package aggregate) ########");
  const catalogMatchers: Record<string, readonly string[]> = {
    "doubao-seed-evolving": ["evolving", "seed-evolving"],
    "deepseek-v4-pro": ["deepseek_v4_pro", "deepseek-v4-pro"],
    "deepseek-v4-flash": ["deepseek_v4_flash", "deepseek-v4-flash"],
    "glm-5-2": ["glm_5.2_free_inference", "glm-5.2"],
    "doubao-seedance-2": ["seedance_2.0_pack_free_infer", "seedance-2.0免费"],
    "doubao-seedance-2-fast": [
      "seedance_2.0_fast_pack_free_infer",
      "seedance-2.0-fast",
    ],
    "doubao-seedance-2-mini": [
      "seedance_2.0_mini",
      "seedance-2.0-mini",
      "seedance_2.0_mini_pack",
      "doubao-seedance-2-0-mini",
    ],
    "doubao-seedream-5-pro": [
      "seedream_5.0_pro",
      "seedream-5.0-pro",
      "seedream_5_0_pro",
    ],
    "doubao-seedream-5": ["seedream_5.0_pack", "seedream-5.0-lite", "seedream-5.0"],
  };

  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const terms = catalogMatchers[entry.canonicalId] ?? [
      entry.canonicalId,
      entry.providerModelId,
    ];
    const matched = full.packages.filter((row) => fuzzyMatchPackage(row, terms));
    const effective = matched.filter((r) => r.Status === "Effective");
    const aggAll = aggregatePackages(matched);
    const aggEffective = aggregatePackages(effective);

    console.log(`\n--- ${entry.canonicalId} (${entry.providerModelId}) ---`);
    console.log(
      `matches=${matched.length} effective=${effective.length} aggEffective=${JSON.stringify(aggEffective)}`
    );
    for (const row of matched) {
      console.log(
        `  [${row.Status}] ${row.ConfigurationCode} | ${row.ConfigurationName} | ${row.AvailableAmount}/${row.TotalAmount} ${row.Unit} | ${row.InstanceNo}`
      );
    }
    if (matched.length === 0) {
      console.log("  => NO PACKAGE (candidate: not provisioned / not enabled)");
    }
  }

  console.log("\n######## SEARCH TERMS IN FULL LIST ########");
  for (const term of SEARCH_TERMS) {
    const hits = full.packages.filter((row) => fuzzyMatchPackage(row, [term]));
    if (hits.length > 0) {
      console.log(`\nterm="${term}" hits=${hits.length}`);
      for (const row of hits) {
        console.log(
          `  ${row.ConfigurationCode} | ${row.ConfigurationName} | ${row.Status}`
        );
      }
    }
  }

  await testFilterVariants();
}

void main();
