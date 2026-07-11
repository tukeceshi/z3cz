import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function callBilling(
  action: string,
  body: Record<string, unknown>
): Promise<void> {
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
  console.log(`\n${action} ${JSON.stringify(body)}`);
  const err = payload.ResponseMetadata?.Error;
  if (err) {
    console.log(`${err.Code}: ${err.Message}`);
    return;
  }
  console.log(JSON.stringify(payload.Result, null, 2).slice(0, 6000));
}

async function main(): Promise<void> {
  const maxValues = [1, 5, 10, 20, 30, 50, 100, 200, 500, 1000];
  for (const MaxResults of maxValues) {
    await callBilling("ListResourcePackages", {
      ResourceType: "Package",
      MaxResults,
    });
  }

  await callBilling("ListResourcePackages", {
    ResourceType: "Package",
    MaxResults: 10,
    NextToken: "",
  });

  await callBilling("ListPackageUsageDetails", {
    ResourceType: "Package",
    MaxResults: 10,
  });
}

void main();
