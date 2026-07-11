/**
 * Probe billing ListResourcePackages with MaxResults + ResourceType.
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

const HOST = "billing.volcengineapi.com";
const SERVICE = "billing";
const VERSION = "2022-01-01";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    console.log(`FAIL ${label}: ${error.Code} ${error.Message}`);
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
    "inference",
    "model_inference",
    "volc_ark",
    "doubao",
    "token",
    "llm",
    "foundation_model",
    "ark_inference",
    "maas",
    "MAAS",
    "machine_learning",
    "MachineLearning",
    "ML",
    "ml",
    "ModelService",
    "model_service",
    "VolcengineArk",
    "volcengine_ark",
    "ByteDanceArk",
    "bytedance_ark",
    "GeneralModel",
    "general_model",
    "LargeModel",
    "large_model",
    "AIModel",
    "ai_model",
    "InferenceToken",
    "inference_token",
    "TokenPackage",
    "token_package",
    "FreeQuota",
    "free_quota",
    "Experience",
    "experience",
    "Trial",
    "trial",
  ] as const;

  for (const resourceType of resourceTypes) {
    await probe(resourceType, {
      ResourceType: resourceType,
      MaxResults: 50,
    });
    await sleep(400);
  }
}

void main();
