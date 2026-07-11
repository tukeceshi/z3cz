/** Fetch doc 1337079 and probe ListResourcePackages with extracted hints. */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function fetchDoc(): Promise<void> {
  try {
    const res = await fetch("https://www.volcengine.com/docs/6269/1337079?lang=zh");
    const html = await res.text();
    const snippets = [
      "ResourceType",
      "MaxResults",
      "NextToken",
      "ListResourcePackages",
      "ResourcePackages",
      "PackageName",
      "AvailableAmount",
      "TotalAmount",
      "Remaining",
      "免费",
      "推理",
      "rpi-",
    ];
    console.log("=== DOC SNIPPETS ===");
    for (const key of snippets) {
      const idx = html.indexOf(key);
      if (idx >= 0) {
        console.log(`\n--- ${key} ---`);
        console.log(html.slice(Math.max(0, idx - 120), idx + 280).replace(/\s+/g, " "));
      }
    }
    // Extract quoted enum-like values near ResourceType
    const enumMatches = html.match(/ResourceType[^<]{0,500}/gi) ?? [];
    console.log("\n=== ResourceType context matches ===");
    for (const m of enumMatches.slice(0, 10)) {
      console.log(m.replace(/\s+/g, " ").slice(0, 400));
    }
  } catch (error) {
    console.log("DOC FETCH FAIL", error);
  }
}

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
  const res = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  const payload = (await res.json()) as Record<string, unknown>;
  const err = (
    payload.ResponseMetadata as { Error?: { Code?: string; Message?: string } }
  )?.Error;
  console.log(`\nPROBE ${JSON.stringify(body)}`);
  if (err) {
    console.log(`${err.Code}: ${err.Message}`);
    return;
  }
  console.log(JSON.stringify(payload.Result ?? payload, null, 2));
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  await fetchDoc();

  const types = [
    "ResourcePackage",
    "resourcepackage",
    "ResourcePackages",
    "InferenceResourcePackage",
    "OnlineInferenceResourcePackage",
    "OnlineInference",
    "VolcArk",
    "volc_ark",
    "VolcengineArk",
    "Ark",
    "ark",
    "ML",
    "MaaS",
    "ModelService",
    "Inference",
    "Package",
    "General",
    "Product",
  ];

  for (const ResourceType of types) {
    await probe({ ResourceType, MaxResults: 20 });
  }
}

void main();
