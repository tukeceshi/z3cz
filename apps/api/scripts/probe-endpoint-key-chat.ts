import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { VOLCANO_ARK_API_KEY_DURATION_SECONDS } from "@dafthunk/types";
import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { VOLCANO_ARK_INFERENCE_BASE_URL, VOLCANO_DEFAULT_PROJECT_NAME } from "../src/integrations/volcengine/constants";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";

function applyDevVars(): void {
  for (const p of [process.env.SECRETS_FILE, resolve(process.cwd(), ".dev.vars")].filter(Boolean)) {
    if (!p || !existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
    }
  }
}

async function chat(apiKey: string, model: string): Promise<void> {
  const res = await fetch(`${VOLCANO_ARK_INFERENCE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "say hi" }], max_tokens: 16 }),
  });
  console.log(`model=${model} status=${res.status}`, (await res.text()).slice(0, 250));
}

async function main(): Promise<void> {
  applyDevVars();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL! });
  const row = (await db.select().from(organizationAiInterfaces).where(eq(organizationAiInterfaces.provider, "doubao_volcano")).limit(1))[0]!;
  const credentials = (await getVolcanoCredentials(process.env as never, row.organizationId, row.metadata))!;
  const endpointId = "ep-20260722212100-brzwk";
  const keyResult = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "GetApiKey",
    body: {
      DurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
      ResourceType: "endpoint",
      ResourceIds: [endpointId],
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
  });
  const apiKey = String(keyResult.ApiKey ?? keyResult.apiKey ?? "");
  console.log("key prefix", apiKey.slice(0, 12));
  await chat(apiKey, "glm-5-2-260617");
  await chat(apiKey, endpointId);
}

void main();
