import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { callVolcengineArkApi } from "../src/integrations/volcengine/client";

async function tryCall(
  label: string,
  action: string,
  body: Record<string, unknown> = {}
): Promise<Record<string, unknown> | null> {
  const credentials = {
    accessKeyId: process.env.VOLC_AK!,
    secretAccessKey: process.env.VOLC_SK!,
    region: "cn-beijing",
  };

  try {
    const raw = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action,
      body,
    });
    console.log(`\n=== OK ${label} ===`);
    console.log(JSON.stringify(raw, null, 2).slice(0, 6000));
    return raw;
  } catch (error) {
    console.error(
      `\n=== FAIL ${label} ===`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const openActions = [
    ["ListFoundationModelOpenings", {}],
    ["ListFoundationModelOpenings", { PageNumber: 1, PageSize: 50 }],
    ["ListFoundationModelOpenInfo", {}],
    ["ListFoundationModelOpenInfo", { PageNumber: 1, PageSize: 50 }],
    ["GetFoundationModelOpenInfo", { Name: "doubao-seed-evolving" }],
    ["ListOpenFoundationModels", {}],
    ["ListOpenFoundationModels", { PageNumber: 1, PageSize: 50 }],
    ["ListModelOpenings", {}],
    ["ListModelOpenings", { PageNumber: 1, PageSize: 50 }],
    ["OpenFoundationModel", { Name: "doubao-seed-evolving" }],
    ["GetFoundationModelOpenStatus", { Name: "doubao-seed-evolving" }],
    ["ListFoundationModelService", {}],
    ["ListServiceOpenings", {}],
    ["ListUserOpenModels", {}],
    ["ListInferenceOpenModels", {}],
    ["ListInferenceOpenInfo", {}],
    ["GetInferenceOpenInfo", {}],
    ["ListAccountFoundationModelOpenings", {}],
    ["ListAccountFoundationModelOpenings", { PageNumber: 1, PageSize: 50 }],
  ] as const;

  for (const [action, body] of openActions) {
    await tryCall(action, action, body);
  }

  // DeepSeek catalog lookup
  for (const filter of ["deepseek", "v4", "seed-evolving", "seedance-2-0"]) {
    const list = await tryCall(
      `ListFoundationModels filter ${filter}`,
      "ListFoundationModels",
      { PageNumber: 1, PageSize: 30, Filter: { Name: filter } }
    );
    if (list?.Items && Array.isArray(list.Items)) {
      for (const item of list.Items as Record<string, unknown>[]) {
        console.log(`  -> ${item.Name} | PrimaryVersion=${item.PrimaryVersion} | ModelId hint`);
        const versions = await tryCall(
          `versions ${String(item.Name)}`,
          "ListFoundationModelVersions",
          { FoundationModelName: item.Name, PageNumber: 1, PageSize: 5 }
        );
        if (versions?.Items && Array.isArray(versions.Items)) {
          for (const v of versions.Items as Record<string, unknown>[]) {
            console.log(`     version ${v.ModelVersion} -> ModelId=${v.ModelId}`);
          }
        }
      }
    }
  }

  // Map catalog IDs to API names
  console.log("\n--- Catalog ID resolution ---");
  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const id = entry.providerModelId;
    const base = id.replace(/-\d{6}$/, "");
    const candidates = [id, base, ...base.split("-").reduce<string[]>((acc, part, i, arr) => {
      if (i < arr.length - 1) acc.push(arr.slice(0, i + 1).join("-"));
      return acc;
    }, [])];

    let resolved: string | null = null;
    let modelId: string | null = null;

    for (const name of [...new Set(candidates)].reverse()) {
      try {
        const fm = await callVolcengineArkApi<Record<string, unknown>>({
          credentials: {
            accessKeyId: process.env.VOLC_AK!,
            secretAccessKey: process.env.VOLC_SK!,
            region: "cn-beijing",
          },
          action: "GetFoundationModel",
          body: { Name: name },
        });
        resolved = String(fm.Name);
        const versions = await callVolcengineArkApi<Record<string, unknown>>({
          credentials: {
            accessKeyId: process.env.VOLC_AK!,
            secretAccessKey: process.env.VOLC_SK!,
            region: "cn-beijing",
          },
          action: "ListFoundationModelVersions",
          body: { FoundationModelName: name, PageNumber: 1, PageSize: 5 },
        });
        const items = versions.Items as Record<string, unknown>[] | undefined;
        const primary = String(fm.PrimaryVersion ?? "");
        const match = items?.find((v) => v.ModelVersion === primary) ?? items?.[0];
        modelId = match ? String(match.ModelId) : null;
        break;
      } catch {
        // try next
      }
    }

    console.log(
      `${entry.canonicalId}: providerModelId=${id} -> FoundationModelName=${resolved ?? "NOT FOUND"} ModelId=${modelId ?? "?"}`
    );
  }
}

void main();
