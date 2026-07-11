import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { extractVolcanoListItems } from "../src/integrations/volcengine/list-endpoints";

async function main(): Promise<void> {
  const credentials = {
    accessKeyId: process.env.VOLC_AK!,
    secretAccessKey: process.env.VOLC_SK!,
    region: "cn-beijing",
  };

  const list = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "ListApiKeys",
    queryParams: { PageNumber: "1", PageSize: "10" },
    body: { ProjectName: "default", Filter: { AllowAll: true } },
  });

  const item = extractVolcanoListItems(list)[0] as Record<string, unknown>;
  const idNum = item.Id;
  const sid = item.SID;

  for (const body of [
    { Id: idNum },
    { Id: String(idNum) },
    { Id: sid },
    { SID: sid },
    { Key: item.Key },
  ]) {
    try {
      const raw = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action: "GetRawApiKey",
        body,
      });
      const apiKey =
        (typeof raw.ApiKey === "string" && raw.ApiKey) ||
        (typeof raw.apiKey === "string" && raw.apiKey) ||
        "";
      console.log("SUCCESS body keys", Object.keys(body), "prefix", apiKey.slice(0, 8));
      return;
    } catch (error) {
      console.log(
        "FAIL body keys",
        Object.keys(body),
        error instanceof Error ? error.message : error
      );
    }
  }
}

void main();
