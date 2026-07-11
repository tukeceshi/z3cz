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
    console.log(JSON.stringify(raw, null, 2).slice(0, 8000));
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

  const endpointActions = [
    ["ListEndpoints", { PageNumber: 1, PageSize: 20, ProjectName: "default" }],
    ["ListEndpoints", { PageNumber: 1, PageSize: 20 }],
    ["ListCustomModels", { PageNumber: 1, PageSize: 20 }],
    ["ListModelCustomizationJobs", { PageNumber: 1, PageSize: 20 }],
    ["ListInferenceService", { PageNumber: 1, PageSize: 20 }],
    ["ListInferenceServices", { PageNumber: 1, PageSize: 20 }],
    ["ListServiceOpenInfo", {}],
    ["ListOpenService", {}],
    ["ListAccountOpenInfo", {}],
    ["GetAccountOpenInfo", {}],
    ["ListModelAccess", {}],
    ["ListModelAccessInfo", {}],
    ["ListFoundationModelAccess", {}],
    ["ListFoundationModelAccessInfo", { PageNumber: 1, PageSize: 50 }],
    ["ListModelService", {}],
    ["ListModelServices", { PageNumber: 1, PageSize: 50 }],
    ["ListArkService", {}],
    ["GetArkService", {}],
    ["ListInferenceEndpoint", { PageNumber: 1, PageSize: 20 }],
    ["ListInferenceEndpoints", { PageNumber: 1, PageSize: 20 }],
  ] as const;

  for (const [action, body] of endpointActions) {
    await tryCall(action, action, body);
  }

  // Paginate ListAccountQuotas and filter for free/token
  let page = 1;
  const allQuotas: Record<string, unknown>[] = [];
  while (page <= 5) {
    const result = await tryCall(
      `ListAccountQuotas page ${page}`,
      "ListAccountQuotas",
      { PageNumber: page, PageSize: 50 }
    );
    if (!result?.Items || !Array.isArray(result.Items)) break;
    allQuotas.push(...(result.Items as Record<string, unknown>[]));
    const total = Number(result.TotalCount ?? 0);
    if (allQuotas.length >= total) break;
    page += 1;
  }

  const keywords = ["free", "Free", "token", "Token", "TPM", "seed", "Seed", "deepseek", "evolving", "seedance", "seedream"];
  console.log("\n--- Quota filter (free/token/model) ---");
  for (const q of allQuotas) {
    const text = JSON.stringify(q);
    if (keywords.some((k) => text.includes(k))) {
      console.log(JSON.stringify(q));
    }
  }
}

void main();
