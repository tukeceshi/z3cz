import { signVolcengineRequest } from "../src/integrations/volcengine/signature";

const TYPES = [
  "Package",
  "package",
  "ARK",
  "ark",
  "ML",
  "maas",
  "MaaS",
  "ModelService",
  "Inference",
  "LLM",
  "Token",
  "GeneralModel",
  "MachineLearning",
  "VolcengineArk",
  "ModelInference",
  "FoundationModel",
  "ExperiencePackage",
  "FreePackage",
  "TrialPackage",
  "InferenceToken",
  "ModelToken",
  "DoubaoModel",
  "VolcArk",
  "MLPlatform",
  "ml_platform",
  "ArkModel",
  "ark_model",
  "ModelArk",
  "model_ark",
] as const;

async function main(): Promise<void> {
  for (const ResourceType of TYPES) {
    const signed = await signVolcengineRequest({
      accessKeyId: process.env.VOLC_AK!.trim(),
      secretAccessKey: process.env.VOLC_SK!.trim(),
      region: "cn-beijing",
      service: "billing",
      host: "billing.volcengineapi.com",
      method: "POST",
      action: "ListResourcePackages",
      version: "2022-01-01",
      body: { ResourceType, MaxResults: 10 },
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
    if (err) {
      console.log(`${ResourceType}\t${err.Code}\t${err.Message}`);
    } else {
      console.log(`OK\t${ResourceType}\t${JSON.stringify(payload.Result).slice(0, 800)}`);
    }
  }
}

void main();
