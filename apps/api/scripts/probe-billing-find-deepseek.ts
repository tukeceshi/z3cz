import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function fetchPage(nextToken?: string) {
  const body: Record<string, unknown> = {
    ResourceType: "Package",
    MaxResults: "20",
  };
  if (nextToken) body.NextToken = nextToken;

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
  return (await res.json()) as {
    Result?: {
      List?: Array<Record<string, string>>;
      NextToken?: string;
    };
  };
}

async function main(): Promise<void> {
  const targets = [
    "rpi-20260704131417-nj9h8",
    "DeepSeek_V4_pro_free_inference_resource_pack",
    "Seedream",
    "seedream",
    "image",
  ];
  let token: string | undefined;
  let page = 0;
  do {
    const payload = await fetchPage(token);
    page += 1;
    for (const row of payload.Result?.List ?? []) {
      const text = JSON.stringify(row);
      if (targets.some((t) => text.includes(t))) {
        console.log(JSON.stringify(row, null, 2));
      }
    }
    const next = payload.Result?.NextToken;
    token = next && next !== "0" ? next : undefined;
  } while (token && page < 10);
}

void main();
