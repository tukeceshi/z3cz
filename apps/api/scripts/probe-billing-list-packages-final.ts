import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

async function call(
  version: string,
  body: Record<string, unknown>
): Promise<void> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: "billing",
    host: "billing.volcengineapi.com",
    method: "POST",
    action: "ListResourcePackages",
    version,
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
  console.log(`v=${version} body=${JSON.stringify(body)}`);
  if (err) console.log(`  ${err.Code}: ${err.Message}`);
  else console.log(`  OK: ${JSON.stringify(payload.Result).slice(0, 1500)}`);
}

async function main(): Promise<void> {
  const versions = ["2020-01-01", "2021-01-01", "2022-01-01", "2023-01-01"];
  for (const version of versions) {
    await call(version, { ResourceType: "Package", MaxResults: 10 });
  }

  const types = [
    "Package",
    "ML",
    "maas",
    "MaaS2023",
    "ark",
    "ARK",
    "ModelArk",
    "Volcengine_Ark",
    "volcengine_ark",
    "MachineLearningPlatform",
    "MLPlatform",
    "ModelService",
    "InferenceService",
    "LargeModel",
    "Doubao",
    "Seed",
    "FoundationModelService",
    "ModelInferenceService",
    "ArkFoundationModel",
    "Experience",
    "Free",
    "Trial",
    "Promotion",
    "Gift",
    "NewUser",
    "CouponPackage",
  ];

  for (const ResourceType of types) {
    await call("2022-01-01", { ResourceType, MaxResults: 10 });
  }

  await call("2022-01-01", { ResourceType: "Package" });
}

void main();
