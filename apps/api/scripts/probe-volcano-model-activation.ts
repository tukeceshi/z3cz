/**
 * Probe model activation via Ark inference API (ModelNotOpen detection).
 * Run: VOLC_AK=... VOLC_SK=... npx tsx scripts/probe-volcano-model-activation.ts
 */
import { VOLCANO_AI_MODEL_CATALOG } from "@dafthunk/types";

import { VOLCANO_ARK_INFERENCE_BASE_URL } from "../src/integrations/volcengine/constants";
import { getVolcanoArkApiKey } from "../src/integrations/volcengine/get-api-key";

interface ArkErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly type?: string;
    readonly message?: string;
    readonly param?: string;
  };
}

interface ProbeResult {
  readonly canonicalId: string;
  readonly modality: string;
  readonly providerModelId: string;
  readonly endpoint: string;
  readonly httpStatus: number;
  readonly activationStatus:
    | "open"
    | "not_open"
    | "auth_error"
    | "other_error"
    | "unknown";
  readonly errorCode: string | null;
  readonly errorType: string | null;
  readonly errorMessage: string | null;
  readonly responseSnippet: string;
}

async function probeInference(params: {
  apiKey: string;
  path: string;
  body: Record<string, unknown>;
}): Promise<{ status: number; json: ArkErrorBody & Record<string, unknown> }> {
  const response = await fetch(`${VOLCANO_ARK_INFERENCE_BASE_URL}${params.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
  });

  const text = await response.text();
  let json: ArkErrorBody & Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as ArkErrorBody & Record<string, unknown>;
  } catch {
    json = { raw: text };
  }

  return { status: response.status, json };
}

function classifyActivation(
  status: number,
  json: ArkErrorBody & Record<string, unknown>
): ProbeResult["activationStatus"] {
  const code = json.error?.code ?? null;
  if (status === 401 || status === 403 || code === "AuthenticationError") {
    return "auth_error";
  }
  if (status === 404 && code === "ModelNotOpen") {
    return "not_open";
  }
  if (status >= 200 && status < 300) {
    return "open";
  }
  // Activated but validation/quota/other (e.g. 400 InvalidParameter, 429)
  if (code && code !== "ModelNotOpen") {
    return "open";
  }
  return "other_error";
}

function buildProbeBody(
  modality: "text" | "image" | "video",
  modelId: string
): { path: string; body: Record<string, unknown> } {
  if (modality === "text") {
    return {
      path: "/chat/completions",
      body: {
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      },
    };
  }

  if (modality === "image") {
    return {
      path: "/images/generations",
      body: {
        model: modelId,
        prompt: "solid red square",
        size: "1024x1024",
        response_format: "url",
        watermark: false,
      },
    };
  }

  return {
    path: "/contents/generations/tasks",
    body: {
      model: modelId,
      content: [{ type: "text", text: "static test frame" }],
      duration: 4,
      ratio: "1:1",
      watermark: false,
    },
  };
}

async function probeModel(
  apiKey: string,
  entry: (typeof VOLCANO_AI_MODEL_CATALOG)[number]
): Promise<ProbeResult> {
  const { path, body } = buildProbeBody(entry.modality, entry.providerModelId);
  const { status, json } = await probeInference({ apiKey, path, body });

  return {
    canonicalId: entry.canonicalId,
    modality: entry.modality,
    providerModelId: entry.providerModelId,
    endpoint: path,
    httpStatus: status,
    activationStatus: classifyActivation(status, json),
    errorCode: json.error?.code ?? null,
    errorType: json.error?.type ?? null,
    errorMessage: json.error?.message ?? null,
    responseSnippet: JSON.stringify(json).slice(0, 500),
  };
}

async function main(): Promise<void> {
  const accessKeyId = process.env.VOLC_AK;
  const secretAccessKey = process.env.VOLC_SK;

  if (!accessKeyId || !secretAccessKey) {
    console.error("Set VOLC_AK and VOLC_SK");
    process.exit(1);
  }

  const credentials = {
    accessKeyId,
    secretAccessKey,
    region: "cn-beijing",
  };

  console.log("Base URL:", VOLCANO_ARK_INFERENCE_BASE_URL);
  console.log("Issuing Ark API key...");

  const issued = await getVolcanoArkApiKey(credentials);
  const apiKey = issued.apiKey;
  console.log(`API key prefix: ${apiKey.slice(0, 8)}...`);

  // Control: definitely nonexistent model
  console.log("\n######## Control: fake model ########");
  const fake = await probeInference({
    apiKey,
    path: "/chat/completions",
    body: {
      model: "definitely-not-a-real-model-000000",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    },
  });
  console.log(JSON.stringify(fake, null, 2));

  // Control: invalid API key
  console.log("\n######## Control: invalid API key ########");
  const badKey = await probeInference({
    apiKey: "sk-invalid-probe-key",
    path: "/chat/completions",
    body: {
      model: "doubao-seed-evolving",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    },
  });
  console.log(JSON.stringify(badKey, null, 2));

  console.log("\n######## Catalog models ########");
  const results: ProbeResult[] = [];

  for (const entry of VOLCANO_AI_MODEL_CATALOG) {
    const result = await probeModel(apiKey, entry);
    results.push(result);
    console.log(
      `\n[${result.activationStatus}] ${result.canonicalId} (${result.modality})`
    );
    console.log(`  model=${result.providerModelId}`);
    console.log(`  ${result.endpoint} -> HTTP ${result.httpStatus}`);
    if (result.errorCode) {
      console.log(`  error.code=${result.errorCode} type=${result.errorType}`);
      console.log(`  message=${result.errorMessage?.slice(0, 200)}`);
    } else {
      console.log(`  snippet=${result.responseSnippet.slice(0, 200)}`);
    }
  }

  // Also probe FoundationModelName instead of ModelId for text models
  console.log("\n######## Variant: FoundationModelName (no version suffix) ########");
  const textEntries = VOLCANO_AI_MODEL_CATALOG.filter((e) => e.modality === "text");
  for (const entry of textEntries) {
    const baseName = entry.providerModelId.replace(/-\d{6}$/, "");
    if (baseName === entry.providerModelId) continue;
    const { status, json } = await probeInference({
      apiKey,
      path: "/chat/completions",
      body: {
        model: baseName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      },
    });
    console.log(
      `  ${entry.canonicalId} model=${baseName} -> HTTP ${status} code=${json.error?.code ?? "ok"}`
    );
  }

  console.log("\n######## Summary ########");
  const summary = {
    open: results.filter((r) => r.activationStatus === "open"),
    not_open: results.filter((r) => r.activationStatus === "not_open"),
    other: results.filter((r) => r.activationStatus === "other_error"),
  };
  console.log(
    `open=${summary.open.length} not_open=${summary.not_open.length} other=${summary.other.length}`
  );
  console.log(JSON.stringify(results, null, 2));
}

void main();
