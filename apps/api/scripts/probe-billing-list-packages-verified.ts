/**
 * Verified request shape from volcengine-go-sdk billing ListResourcePackagesInput:
 * - ResourceType: "Package" | "RI" | "RSC"
 * - MaxResults: string (required)
 * Doc: https://docs.volcengine.com/docs/6269/1337079?lang=zh
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function call(body: Record<string, unknown>): Promise<void> {
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
  const res = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await res.json()) as Record<string, unknown>;
  const err = (
    payload.ResponseMetadata as { Error?: { Code?: string; Message?: string } }
  )?.Error;
  console.log(`\n=== REQ ${JSON.stringify(body)} ===`);
  if (err) {
    console.log(`ERR ${err.Code}: ${err.Message}`);
    return;
  }
  console.log(JSON.stringify(payload.Result ?? payload, null, 2));
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  await call({ ResourceType: "Package", MaxResults: "20" });
  await call({ ResourceType: "Package", MaxResults: "20", Status: "Effective" });
  await call({
    ResourceType: "Package",
    MaxResults: "50",
    Status: "Effective",
    Product: "ML",
  });
  await call({
    ResourceType: "Package",
    MaxResults: "50",
    Status: "Effective",
    Product: "ark",
  });
  await call({
    ResourceType: "Package",
    MaxResults: "50",
    Status: "Effective",
    Product: "VolcArk",
  });
  await call({ ResourceType: "RI", MaxResults: "20" });
  await call({ ResourceType: "RSC", MaxResults: "20" });
}

void main();
