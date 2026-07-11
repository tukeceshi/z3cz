/** Test cost-minimized inference probes (InvalidParameter vs full generation). */
import { VOLCANO_ARK_INFERENCE_BASE_URL } from "../src/integrations/volcengine/constants";
import { getVolcanoArkApiKey } from "../src/integrations/volcengine/get-api-key";

async function post(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${VOLCANO_ARK_INFERENCE_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json };
}

async function main(): Promise<void> {
  const issued = await getVolcanoArkApiKey({
    accessKeyId: process.env.VOLC_AK!,
    secretAccessKey: process.env.VOLC_SK!,
    region: "cn-beijing",
  });
  const apiKey = issued.apiKey;

  const cases = [
    [
      "seedream-pro tiny size",
      "/images/generations",
      {
        model: "doubao-seedream-5-0-pro-260628",
        prompt: "x",
        size: "1024x1024",
        watermark: false,
      },
    ],
    [
      "seedream-pro invalid size",
      "/images/generations",
      {
        model: "doubao-seedream-5-0-pro-260628",
        prompt: "x",
        size: "1x1",
        watermark: false,
      },
    ],
    [
      "seedance-2 invalid duration",
      "/contents/generations/tasks",
      {
        model: "doubao-seedance-2-0-260128",
        content: [{ type: "text", text: "x" }],
        duration: 0,
        ratio: "1:1",
      },
    ],
    [
      "seedance-2 NOT_OPEN mini",
      "/contents/generations/tasks",
      {
        model: "doubao-seedance-2-0-mini-260615",
        content: [{ type: "text", text: "x" }],
        duration: 0,
        ratio: "1:1",
      },
    ],
    [
      "evolving NOT_OPEN text",
      "/chat/completions",
      {
        model: "doubao-seed-evolving",
        messages: [{ role: "user", content: "x" }],
        max_tokens: 1,
      },
    ],
  ] as const;

  for (const [label, path, body] of cases) {
    const { status, json } = await post(apiKey, path, body);
    const err = json.error as Record<string, unknown> | undefined;
    console.log(
      `${label}: HTTP ${status} code=${err?.code ?? "ok"} hasTask=${Boolean(json.id)} hasImage=${Boolean((json.data as unknown[])?.[0])}`
    );
    if (err) console.log(`  msg=${String(err.message).slice(0, 120)}`);
  }
}

void main();
