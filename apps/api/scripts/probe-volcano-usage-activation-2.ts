/**
 * Extended GetInferenceUsage edge cases for activation detection.
 */
import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { formatVolcanoUsageDate } from "../src/integrations/volcengine/get-inference-usage";

async function tryUsage(
  label: string,
  body: Record<string, unknown>
): Promise<void> {
  const credentials = {
    accessKeyId: process.env.VOLC_AK!,
    secretAccessKey: process.env.VOLC_SK!,
    region: "cn-beijing",
  };

  try {
    const raw = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "GetInferenceUsage",
      body,
    });
    const fields = Array.isArray(raw.Fields)
      ? (raw.Fields as Record<string, unknown>[]).map((f) => f.Name)
      : [];
    const rows = raw.Rows ?? raw.rows ?? [];
    const rowArray = Array.isArray(rows) ? rows : [];
    console.log(`\n=== OK ${label} ===`);
    console.log(`  DataCount=${raw.DataCount} rows=${rowArray.length} fields=[${fields.join(",")}]`);
    if (rowArray.length > 0) {
      console.log(`  sample row: ${JSON.stringify(rowArray[0]).slice(0, 500)}`);
    }
    console.log(JSON.stringify(raw).slice(0, 1200));
  } catch (error) {
    console.error(`\n=== FAIL ${label} ===`, error instanceof Error ? error.message : error);
  }
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);

  const base = {
    StartTime: formatVolcanoUsageDate(start),
    EndTime: formatVolcanoUsageDate(now),
    QueryInterval: "Day",
    ProjectName: "default",
  };

  // Wider window - maybe usage lags
  const start90 = new Date(now);
  start90.setDate(start90.getDate() - 89);
  const wide = {
    ...base,
    StartTime: formatVolcanoUsageDate(start90),
  };

  await tryUsage("no-filter 29d", base);
  await tryUsage("no-filter 90d", wide);

  await tryUsage("GroupBy ModelName only", {
    ...base,
    GroupByFields: ["ModelName"],
  });

  await tryUsage("GroupBy ModelName+Billing", {
    ...base,
    GroupByFields: ["ModelName", "BillingStatus"],
  });

  // NOT_OPEN models
  await tryUsage("NOT_OPEN evolving filter", {
    ...base,
    ModelName: "doubao-seed-evolving",
  });
  await tryUsage("NOT_OPEN mini filter", {
    ...base,
    ModelName: "doubao-seedance-2-0-mini-260615",
  });

  // OPEN models with recent inference
  await tryUsage("OPEN seedream-pro filter", {
    ...base,
    ModelName: "doubao-seedream-5-0-pro-260628",
  });
  await tryUsage("OPEN seedance-2 filter", {
    ...base,
    ModelName: "doubao-seedance-2-0-260128",
  });

  // Invalid / fake models
  await tryUsage("fake model id", {
    ...base,
    ModelName: "definitely-not-a-real-model-000000",
  });
  await tryUsage("invalid foundation only", {
    ...base,
    ModelName: "deepseek-v4-pro",
  });

  // Try ServiceNotOpen trigger guesses
  const guesses = [
    ["OperationDenied.ServiceNotOpen model", { ...base, ModelName: "doubao-seed-evolving", ServiceName: "inference" }],
    ["RestrictOpen model", { ...base, ModelName: "doubao-seed-evolving", IncludeInactive: true }],
    ["ListInactiveModels", { ...base, IncludeUnactivated: true }],
    ["ModelName empty string", { ...base, ModelName: "" }],
  ] as const;

  for (const [label, body] of guesses) {
    await tryUsage(label, body);
  }

  // Per-model GroupBy with filter?
  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    await tryUsage(`per-model ${entry.canonicalId}`, {
      ...base,
      ModelName: entry.providerModelId,
      GroupByFields: ["ModelName", "BillingStatus"],
    });
  }
}

void main();
