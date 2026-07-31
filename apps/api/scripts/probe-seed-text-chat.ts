/**
 * Verify Seed Evolving text chat after model-scoped Ark key fix.
 * Run: docker exec -w /app/apps/api dafthunk-api-dev pnpm exec tsx scripts/probe-seed-text-chat.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import {
  VOLCANO_ARK_INFERENCE_BASE_URL,
} from "../src/integrations/volcengine/constants";
import {
  ensureVolcanoApiKey,
  getVolcanoCredentials,
} from "../src/integrations/volcengine/ensure-api-key";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../src/integrations/volcengine/metadata";
import { resolveVolcanoInferenceModelId } from "@dafthunk/types";

const ORG_ID = "019f9cf9-e5b3-720f-9b26-babb3ed15830";
const SEED_ID = "doubao-seed-evolving";

function loadDevVars(): Record<string, string> {
  const paths = [
    process.env.SECRETS_FILE,
    "/data/secrets/.dev.vars",
    process.env.DEV_VARS_FILE,
    resolve(process.cwd(), ".dev.vars"),
  ].filter((value): value is string => Boolean(value));

  const vars: Record<string, string> = {};
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;
      vars[trimmed.slice(0, eqIndex).trim()] = trimmed
        .slice(eqIndex + 1)
        .trim();
    }
  }
  return vars;
}

function applyDevVars(): void {
  for (const [key, value] of Object.entries(loadDevVars())) {
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  applyDevVars();
  if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY) {
    throw new Error("DATABASE_URL and SECRET_MASTER_KEY are required");
  }

  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL });
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.organizationId, ORG_ID));

  const row = rows.find((entry) => entry.provider === "doubao_volcano");
  if (!row) {
    throw new Error(`No doubao_volcano interface for org ${ORG_ID}`);
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(metadata)) {
    throw new Error("Invalid volcano metadata");
  }

  const seedConfig = metadata.models[SEED_ID];
  console.log("before", {
    seedEnabled: seedConfig?.enabled ?? false,
    seedEndpoint: metadata.arkEndpoints?.[SEED_ID] ?? null,
    scope: metadata.arkApiKeyScope ?? null,
  });

  if (!seedConfig?.enabled) {
    throw new Error("Enable doubao-seed-evolving on the volcano interface first");
  }

  const ensured = await ensureVolcanoApiKey({
    env: process.env as never,
    organizationId: row.organizationId,
    metadataRaw: row.metadata,
    apiKeyEncrypted: row.apiKeyEncrypted ?? "",
  });

  if (ensured.metadataChanged || ensured.renewed) {
    await db
      .update(organizationAiInterfaces)
      .set({
        metadata: ensured.metadataRaw,
        apiKeyEncrypted: ensured.apiKeyEncrypted,
        updatedAt: new Date(),
      })
      .where(eq(organizationAiInterfaces.id, row.id));
  }

  const nextMeta = parseInterfaceMetadata(ensured.metadataRaw);
  if (!isVolcanoMetadata(nextMeta)) {
    throw new Error("Ensured metadata invalid");
  }

  console.log("after ensure", {
    scope: nextMeta.arkApiKeyScope ?? null,
    seedEndpoint: nextMeta.arkEndpoints?.[SEED_ID] ?? null,
    renewed: ensured.renewed,
    hasApiKey: Boolean(ensured.apiKey),
  });

  if (!ensured.apiKey) {
    throw new Error("No Ark API key after ensure");
  }

  const model = resolveVolcanoInferenceModelId({
    canonicalId: SEED_ID,
    providerModelId:
      nextMeta.models[SEED_ID]?.providerModelId ?? "doubao-seed-evolving",
    metadata: nextMeta,
  });

  const response = await fetch(
    `${VOLCANO_ARK_INFERENCE_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ensured.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "用一句话介绍你自己" }],
        max_tokens: 64,
      }),
    }
  );

  const text = await response.text();
  console.log(`chat HTTP ${response.status}`);
  console.log(text.slice(0, 800));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
