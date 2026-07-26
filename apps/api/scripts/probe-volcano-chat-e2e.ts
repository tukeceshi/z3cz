/**
 * End-to-end: ensure API key + chat for glm via auto-created endpoints.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { ensureVolcanoApiKey } from "../src/integrations/volcengine/ensure-api-key";
import { VOLCANO_ARK_INFERENCE_BASE_URL } from "../src/integrations/volcengine/constants";
import { parseInterfaceMetadata, isVolcanoMetadata } from "../src/integrations/volcengine/metadata";
import { resolveVolcanoInferenceModelId } from "@dafthunk/types";

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
  console.log(`chat model=${model} status=${res.status}`, (await res.text()).slice(0, 180));
}

async function main(): Promise<void> {
  applyDevVars();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL! });
  const row = (await db.select().from(organizationAiInterfaces).where(eq(organizationAiInterfaces.provider, "doubao_volcano")).limit(1))[0]!;
  const ensured = await ensureVolcanoApiKey({
    env: process.env as never,
    organizationId: row.organizationId,
    metadataRaw: row.metadata,
    apiKeyEncrypted: row.apiKeyEncrypted,
  });
  console.log({ renewed: ensured.renewed, metadataChanged: ensured.metadataChanged, hasKey: Boolean(ensured.apiKey) });
  const metadata = parseInterfaceMetadata(ensured.metadataRaw);
  if (!isVolcanoMetadata(metadata)) throw new Error("bad metadata");
  for (const id of ["glm-5-2"] as const) {
    const config = metadata.models[id];
    console.log(id, config, metadata.arkEndpoints?.[id], metadata.arkApiKeyScope);
    if (!config || !ensured.apiKey) continue;
    const model = resolveVolcanoInferenceModelId({
      canonicalId: id,
      providerModelId: config.providerModelId,
      metadata,
    });
    await chat(ensured.apiKey, model);
  }
}

void main();
