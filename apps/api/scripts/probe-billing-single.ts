import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function main(): Promise<void> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: "billing",
    host: "billing.volcengineapi.com",
    method: "POST",
    action: "ListResourcePackages",
    version: "2022-01-01",
    body: {
      ResourceType: "Package",
      MaxResults: 10,
    },
  });

  console.log("URL", signed.url);
  console.log("BODY", signed.body);

  const res = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const text = await res.text();
  console.log("STATUS", res.status);
  console.log(text);
}

void main();
