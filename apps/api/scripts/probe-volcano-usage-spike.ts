import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { formatVolcanoUsageDate } from "../src/integrations/volcengine/get-inference-usage";

async function tryCall(
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
      ? raw.Fields.map((f) =>
          f && typeof f === "object"
            ? (f as Record<string, unknown>).Name
            : null
        )
      : [];
    console.log(`OK ${label}: [${fields.join(", ")}]`);
  } catch (error) {
    console.error(
      `FAIL ${label}:`,
      error instanceof Error ? error.message : error
    );
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

  const guesses = [
    ["GroupByFields", { ...base, GroupByFields: ["ModelName", "BillingStatus"] }],
    ["GroupByFields billing", { ...base, GroupByFields: ["BillingStatus"] }],
    ["ShowDetail true", { ...base, ShowDetail: true }],
    ["Detail true", { ...base, Detail: true }],
    ["WithDetail true", { ...base, WithDetail: true }],
    ["Granularity model", { ...base, Granularity: "model" }],
    ["StatType model", { ...base, StatType: "model" }],
    ["QueryType model", { ...base, QueryType: "model" }],
    ["Breakdown ModelName", { ...base, Breakdown: "ModelName" }],
    ["SplitBy ModelName", { ...base, SplitBy: "ModelName" }],
  ] as const;

  for (const [label, body] of guesses) {
    await tryCall(label, body);
  }
}

void main();
