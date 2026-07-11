/**
 * Probe quota/plan APIs that might expose token balance.
 */
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
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action,
      body,
    });
    console.log(`\n=== OK ${label} ===`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    console.log(`\n=== FAIL ${label} === ${code} ${message}`);
    return null;
  }
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const actions: Array<[string, string, Record<string, unknown>]> = [
    ["ListAccountQuotas all", "ListAccountQuotas", { PageNumber: 1, PageSize: 100 }],
    ["GetPersonalPlan", "GetPersonalPlan", {}],
    ["GetUsageDetails", "GetUsageDetails", {}],
    ["GetAFPUsage", "GetAFPUsage", {}],
    ["ListArkCodingPlanModel", "ListArkCodingPlanModel", {}],
    ["ListArkAgentPlanModel", "ListArkAgentPlanModel", {}],
    [
      "ListResourcePackages",
      "ListResourcePackages",
      { PageNumber: 1, PageSize: 50 },
    ],
  ];

  for (const [label, action, body] of actions) {
    await tryCall(label, action, body);
  }
}

void main();
