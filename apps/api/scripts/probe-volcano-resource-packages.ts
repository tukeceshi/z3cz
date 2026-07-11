/**
 * Probe ListResourcePackages and related resource package APIs.
 * Run: VOLC_AK=... VOLC_SK=... npx tsx scripts/probe-volcano-resource-packages.ts
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
    console.log(`\n=== OK ${label} (${action}) ===`);
    console.log(JSON.stringify(result, null, 2).slice(0, 8000));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    console.log(`\n=== FAIL ${label} (${action}) ===`);
    console.log(`  code=${code} message=${message}`);
    return null;
  }
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const pagination = { PageNumber: 1, PageSize: 50 };
  const modelFilters = [
    { label: "no filter", body: pagination },
    {
      label: "FoundationModelName seedance-2-0",
      body: { ...pagination, FoundationModelName: "doubao-seedance-2-0" },
    },
    {
      label: "ModelName seedance model id",
      body: { ...pagination, ModelName: "doubao-seedance-2-0-260128" },
    },
    {
      label: "Filter FoundationModelName",
      body: {
        ...pagination,
        Filter: { FoundationModelName: "doubao-seedance-2-0" },
      },
    },
    {
      label: "ProjectName default",
      body: { ...pagination, ProjectName: "default" },
    },
  ];

  const actions = [
    "ListResourcePackages",
    "ListInferenceResourcePackages",
    "ListBillingResourcePackages",
    "ListPrepaidResourcePackages",
    "ListPostpaidResourcePackages",
    "ListResourcePackageInstances",
    "ListAccountQuotas",
    "GetResourcePackage",
    "DescribeResourcePackages",
  ] as const;

  for (const action of actions) {
    if (action === "GetResourcePackage") {
      await tryCall(`${action} empty`, action, {});
      continue;
    }
    for (const filter of modelFilters) {
      await tryCall(`${action} ${filter.label}`, action, filter.body);
    }
  }
}

void main();
