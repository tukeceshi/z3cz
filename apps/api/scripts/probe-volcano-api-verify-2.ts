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
    console.log(JSON.stringify(raw, null, 2).slice(0, 5000));
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

  // Correct parameter names for versions
  await tryCall("ListFoundationModelVersions evolving", "ListFoundationModelVersions", {
    FoundationModelName: "doubao-seed-evolving",
    PageNumber: 1,
    PageSize: 10,
  });

  await tryCall("ListFoundationModelVersions seedream", "ListFoundationModelVersions", {
    FoundationModelName: "doubao-seedream-5-0-pro",
    PageNumber: 1,
    PageSize: 10,
  });

  await tryCall("GetFoundationModelVersion seedream 260628", "GetFoundationModelVersion", {
    FoundationModelName: "doubao-seedream-5-0-pro",
    ModelVersion: "260628",
  });

  // Activation / open management guesses
  const activationActions = [
    ["ListModelActivation", {}],
    ["ListActivatedModels", {}],
    ["ListOpenedModels", {}],
    ["ListSubscribedModels", {}],
    ["ListModelSubscriptions", { PageNumber: 1, PageSize: 50 }],
    ["ListOpenModels", {}],
    ["ListServiceActivation", {}],
    ["GetServiceActivation", {}],
    ["ListAccountQuotas", {}],
    ["ListInferenceQuotas", {}],
    ["ListArkQuotas", {}],
    ["ListPrepaidResourcePackages", { PageNumber: 1, PageSize: 20 }],
    ["ListPostpaidResourcePackages", { PageNumber: 1, PageSize: 20 }],
    ["ListResourcePackageInstances", { PageNumber: 1, PageSize: 20 }],
    ["ListInferenceUsagePackages", { PageNumber: 1, PageSize: 20 }],
  ] as const;

  for (const [action, body] of activationActions) {
    await tryCall(action, action, body);
  }

  // Search catalog models in ListFoundationModels with filter
  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const baseName = entry.providerModelId.replace(/-\d{6}$/, "").replace(/-260\d+$/, "");
    const guesses = [
      entry.providerModelId,
      baseName,
      entry.providerModelId.split("-").slice(0, -1).join("-"),
    ];

    for (const name of [...new Set(guesses)]) {
      const result = await tryCall(
        `GetFoundationModel ${name}`,
        "GetFoundationModel",
        { Name: name }
      );
      if (result) break;
    }
  }

  // List all with filter by name
  const list = await tryCall("ListFoundationModels filter seedance", "ListFoundationModels", {
    PageNumber: 1,
    PageSize: 20,
    Filter: { Name: "seedance" },
  });

  if (list?.Items && Array.isArray(list.Items)) {
    console.log("\n--- seedance filter items ---");
    for (const item of list.Items as Record<string, unknown>[]) {
      console.log(`  ${item.Name} | v${item.PrimaryVersion}`);
    }
  }
}

void main();
