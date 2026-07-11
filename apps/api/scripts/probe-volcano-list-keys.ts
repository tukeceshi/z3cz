import { callVolcengineArkApi } from "../src/integrations/volcengine/client";

async function main(): Promise<void> {
  const credentials = {
    accessKeyId: process.env.VOLC_AK!,
    secretAccessKey: process.env.VOLC_SK!,
    region: "cn-beijing",
  };

  const result = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "ListApiKeys",
    queryParams: { PageNumber: "1", PageSize: "10" },
    body: { ProjectName: "default", Filter: { AllowAll: true } },
  });

  console.log("top-level keys:", Object.keys(result));
  const items = result.Items;
  if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
    const item = items[0] as Record<string, unknown>;
    console.log("item keys:", Object.keys(item));
    for (const [key, value] of Object.entries(item)) {
      const kind = Array.isArray(value) ? "array" : typeof value;
      console.log(`  ${key}: ${kind}`);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
