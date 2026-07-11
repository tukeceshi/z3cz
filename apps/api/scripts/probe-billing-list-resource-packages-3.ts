/**
 * Probe billing ListResourcePackages pagination param shapes.
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function probe(body: Record<string, unknown>): Promise<void> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: "billing",
    host: "billing.volcengineapi.com",
    method: "POST",
    action: "ListResourcePackages",
    version: "2022-01-01",
    body,
  });

  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  const meta = payload.ResponseMetadata as Record<string, unknown> | undefined;
  const error = meta?.Error as Record<string, unknown> | undefined;
  console.log(`\nREQ ${JSON.stringify(body)}`);
  if (error) {
    console.log(`ERR ${error.Code}: ${error.Message}`);
    return;
  }
  console.log(`OK ${JSON.stringify(payload.Result ?? payload).slice(0, 4000)}`);
}

async function main(): Promise<void> {
  const resourceTypes = ["ark", "maas", "ML", "machine_learning", "inference"];
  const maxResultsValues = [1, 10, 20, 50, 100, "10", "20"];

  for (const resourceType of resourceTypes) {
    for (const maxResults of maxResultsValues) {
      await probe({ ResourceType: resourceType, MaxResults: maxResults });
    }
    await probe({ ResourceType: resourceType, PageSize: 20, PageNumber: 1 });
    await probe({ ResourceType: resourceType, Limit: 20 });
    await probe({ ResourceType: resourceType });
  }
}

void main();
