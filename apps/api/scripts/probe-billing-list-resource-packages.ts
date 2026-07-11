/**
 * Probe billing ListResourcePackages with ResourceType variants.
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

const HOST = "billing.volcengineapi.com";
const SERVICE = "billing";
const VERSION = "2022-01-01";

async function probe(
  label: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const signed = await signVolcengineRequest({
    accessKeyId: process.env.VOLC_AK!.trim(),
    secretAccessKey: process.env.VOLC_SK!.trim(),
    region: "cn-beijing",
    service: SERVICE,
    host: HOST,
    method: "POST",
    action: "ListResourcePackages",
    version: VERSION,
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
  if (error) {
    console.log(`\n=== FAIL ${label} ===`);
    console.log(`${error.Code}: ${error.Message}`);
    return null;
  }
  const result = (payload.Result ?? payload) as Record<string, unknown>;
  console.log(`\n=== OK ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const resourceTypes = [
    "ark",
    "Ark",
    "ARK",
    "ml_platform",
    "MLPlatform",
    "inference",
    "Inference",
    "model_inference",
    "ModelInference",
    "volc_ark",
    "VolcArk",
    "doubao",
    "Doubao",
    "token",
    "Token",
    "llm",
    "LLM",
    "foundation_model",
    "FoundationModel",
    "ark_inference",
    "ArkInference",
    "maas",
    "MAAS",
    "machine_learning",
  ] as const;

  for (const resourceType of resourceTypes) {
    await probe(`ResourceType=${resourceType}`, {
      PageNumber: 1,
      PageSize: 50,
      ResourceType: resourceType,
    });
  }

  // Also try with Product / ServiceCode style params
  const combos = [
    { ResourceType: "ark", Product: "ark" },
    { ResourceType: "ark", ServiceCode: "ark" },
    { ResourceType: "inference", Product: "ark" },
    { ResourceType: "token", Product: "ark" },
    { ResourceType: "ark", Region: "cn-beijing" },
    { ResourceType: "ark", ProjectName: "default" },
    {
      ResourceType: "ark",
      Filter: { FoundationModelName: "doubao-seedance-2-0" },
    },
    {
      ResourceType: "ark",
      ModelName: "doubao-seedance-2-0-260128",
    },
  ] as const;

  for (const body of combos) {
    await probe(`combo ${JSON.stringify(body)}`, { PageNumber: 1, PageSize: 50, ...body });
  }
}

void main();
