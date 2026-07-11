import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function callBilling(action: string, body: Record<string, unknown> = {}): Promise<void> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: "billing",
    host: "billing.volcengineapi.com",
    method: "POST",
    action,
    version: "2022-01-01",
    body,
  });
  const res = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await res.json()) as {
    ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
    Result?: unknown;
  };
  const err = payload.ResponseMetadata?.Error;
  console.log(`\n${action}`);
  if (err) console.log(`${err.Code}: ${err.Message}`);
  else console.log(JSON.stringify(payload.Result, null, 2).slice(0, 8000));
}

async function main(): Promise<void> {
  await callBilling("ListResourceTypes", { MaxResults: 100 });
  await callBilling("ListResourceTypes", {});
  await callBilling("ListProduct", { MaxResults: 100 });
  await callBilling("ListProducts", { MaxResults: 100 });
  await callBilling("ListResourcePackages", {
    ResourceType: "Package",
    MaxResults: 10,
  });
}

void main();
