/**
 * Probe ListResourcePackages per official doc:
 * https://docs.volcengine.com/docs/6269/1337079?lang=zh
 */
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

const HOST = "billing.volcengineapi.com";
const SERVICE = "billing";
const VERSION = "2022-01-01";

async function call(
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

  console.log(`\n=== ${label} ===`);
  console.log("REQ", JSON.stringify(body));

  if (error) {
    console.log(`ERR ${error.Code}: ${error.Message}`);
    return null;
  }

  const result = (payload.Result ?? payload) as Record<string, unknown>;
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main(): Promise<void> {
  if (!process.env.VOLC_AK || !process.env.VOLC_SK) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  // Doc-common ResourceType guesses for inference resource packages
  const resourceTypes = [
    "ResourcePackage",
    "resource_package",
    "InferenceResourcePackage",
    "OnlineInferenceResourcePackage",
    "OnlineInference",
    "Inference",
    "ModelInference",
    "ArkInference",
    "VolcengineArk",
    "ML",
    "MaaS",
    "Package",
  ] as const;

  for (const ResourceType of resourceTypes) {
    await call(`ResourceType=${ResourceType}`, {
      ResourceType,
      MaxResults: 20,
    });
  }

  // Doc may use different pagination field names
  await call("PageSize/PageNumber", {
    ResourceType: "ResourcePackage",
    PageNumber: 1,
    PageSize: 20,
  });

  await call("Limit/Offset", {
    ResourceType: "ResourcePackage",
    Limit: 20,
    Offset: 0,
  });
}

void main();
