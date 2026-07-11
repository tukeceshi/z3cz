import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { formatVolcanoUsageDate } from "../src/integrations/volcengine/get-inference-usage";

const OPEN_MANAGEMENT_URL =
  "https://console.volcengine.com/ark/region:cn-beijing/openManagement";

async function tryCall(
  label: string,
  action: string,
  body: Record<string, unknown> = {},
  queryParams?: Record<string, string>
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
      queryParams,
    });
    console.log(`\n=== OK ${label} ===`);
    console.log(JSON.stringify(raw, null, 2).slice(0, 4000));
    return raw;
  } catch (error) {
    console.error(
      `\n=== FAIL ${label} ===`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function probeGetInferenceUsage(): Promise<void> {
  console.log("\n######## GetInferenceUsage ########");
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);

  const base = {
    StartTime: formatVolcanoUsageDate(start),
    EndTime: formatVolcanoUsageDate(now),
    QueryInterval: "Day",
    ProjectName: "default",
  };

  await tryCall("usage no filter", "GetInferenceUsage", base);

  for (const entry of VOLCANO_AI_MODEL_CATALOG.slice(0, 2)) {
    await tryCall(
      `usage ModelName=${entry.providerModelId}`,
      "GetInferenceUsage",
      { ...base, ModelName: entry.providerModelId }
    );
  }

  const billingStatuses = [
    "free_for_free_quota",
    "free_for_limit_boundary",
    "paid",
    "pay_as_you_go",
    "package",
    "resource_package",
    "token_package",
    "prepaid",
    "postpaid",
  ];

  for (const status of billingStatuses) {
    await tryCall(
      `usage BillingStatus=${status}`,
      "GetInferenceUsage",
      { ...base, BillingStatus: status }
    );
  }
}

async function probeFoundationModels(): Promise<void> {
  console.log("\n######## Foundation Models ########");
  const catalogIds = VOLCANO_AI_MODEL_CATALOG.map((e) => e.providerModelId);

  const list = await tryCall("ListFoundationModels", "ListFoundationModels", {
    PageNumber: 1,
    PageSize: 50,
    ProjectName: "default",
  });

  if (list && Array.isArray(list.Items)) {
    const items = list.Items as Record<string, unknown>[];
    console.log(`\n--- ListFoundationModels: ${items.length} items ---`);
    for (const item of items.slice(0, 15)) {
      const name = item.Name ?? item.name;
      const display = item.DisplayName ?? item.displayName;
      const keys = Object.keys(item).sort().join(", ");
      const matched = catalogIds.filter(
        (id) =>
          String(name).includes(id) ||
          String(id).includes(String(name)) ||
          String(display).includes(id)
      );
      console.log(`  ${String(name)} | ${String(display)} | keys=[${keys}]`);
      if (matched.length) console.log(`    catalog match: ${matched.join(", ")}`);
    }

    for (const id of catalogIds) {
      const hit = items.find(
        (item) =>
          item.Name === id ||
          item.Name === id.replace(/-/g, "_") ||
          String(item.DisplayName ?? "").toLowerCase().includes(id.split("-")[0]!)
      );
      if (hit) {
        console.log(`\n--- catalog id ${id} matched item ---`);
        console.log(JSON.stringify(hit, null, 2).slice(0, 1500));
      }
    }
  }

  for (const id of catalogIds.slice(0, 3)) {
    await tryCall(`GetFoundationModel Name=${id}`, "GetFoundationModel", {
      Name: id,
    });
  }
}

async function probeVersionsAndPackages(): Promise<void> {
  console.log("\n######## Versions & Packages ########");

  const versionActions = [
    [
      "ListFoundationModelVersions",
      { FoundationModelName: "doubao-seed-evolving", PageNumber: 1, PageSize: 10 },
    ],
    [
      "ListFoundationModelVersions",
      { FoundationModelName: "doubao-seedance-2-0", PageNumber: 1, PageSize: 10 },
    ],
    [
      "GetFoundationModelVersion",
      { FoundationModelName: "doubao-seedream-5-0-pro", ModelVersion: "260628" },
    ],
  ] as const;

  for (const [action, body] of versionActions) {
    await tryCall(`${action} ${JSON.stringify(body)}`, action, body);
  }

  const packageActions = [
    ["ListPurchaseInfo", { PageNumber: 1, PageSize: 20 }],
    ["ListUsageInfo", { PageNumber: 1, PageSize: 20 }],
    ["ListResourcePackages", { PageNumber: 1, PageSize: 20 }],
    ["ListInferenceResourcePackages", { PageNumber: 1, PageSize: 20 }],
    ["ListQuota", {}],
    ["GetQuota", {}],
    ["ListBillingResourcePackages", { PageNumber: 1, PageSize: 20 }],
  ] as const;

  for (const [action, body] of packageActions) {
    await tryCall(action, action, body);
  }
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  console.log("Open management URL:", OPEN_MANAGEMENT_URL);
  await probeGetInferenceUsage();
  await probeFoundationModels();
  await probeVersionsAndPackages();
}

void main();
