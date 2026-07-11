import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { getVolcanoArkApiKey } from "../src/integrations/volcengine/get-api-key";
import { listVolcanoEndpointIds } from "../src/integrations/volcengine/list-endpoints";

async function main(): Promise<void> {
  const accessKeyId = process.env.VOLC_AK;
  const secretAccessKey = process.env.VOLC_SK;

  if (!accessKeyId || !secretAccessKey) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const credentials = {
    accessKeyId,
    secretAccessKey,
    region: "cn-beijing",
  };

  async function step(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`OK ${name}`);
    } catch (error) {
      console.error(
        `FAIL ${name}:`,
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  await step("ListEndpoints", async () => {
    const ids = await listVolcanoEndpointIds(credentials);
    console.log(`  endpoints: ${ids.length}`);
  });

  await step("ListApiKeys", async () => {
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "ListApiKeys",
      queryParams: { PageNumber: "1", PageSize: "10" },
      body: { ProjectName: "default", Filter: { AllowAll: true } },
    });
    const items = result.Items;
    console.log(`  api keys: ${Array.isArray(items) ? items.length : 0}`);
  });

  await step("getVolcanoArkApiKey", async () => {
    const issued = await getVolcanoArkApiKey(credentials);
    console.log(`  api key prefix: ${issued.apiKey.slice(0, 8)}...`);
    console.log(`  expires: ${issued.expiresAt}`);
  });

  console.log("All volcano API steps passed.");
}

void main();
