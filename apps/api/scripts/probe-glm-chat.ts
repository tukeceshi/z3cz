/**
 * Probe GLM-5.2 chat model IDs against Volcano Ark inference API.
 * Run inside api container:
 *   npx tsx scripts/probe-glm-chat.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import {
  VOLCANO_ARK_INFERENCE_BASE_URL,
  VOLCANO_ARK_API_KEY_DURATION_SECONDS,
  VOLCANO_DEFAULT_PROJECT_NAME,
} from "../src/integrations/volcengine/constants";
import {
  ensureVolcanoApiKey,
  getVolcanoCredentials,
} from "../src/integrations/volcengine/ensure-api-key";
import { getVolcanoArkApiKey } from "../src/integrations/volcengine/get-api-key";

const CANDIDATES = ["glm-5.2", "glm-5-2", "glm-5-2-260617"] as const;

function loadDevVars(): Record<string, string> {
  const paths = [
    process.env.SECRETS_FILE,
    process.env.DEV_VARS_FILE,
    resolve(process.cwd(), ".dev.vars"),
  ].filter((value): value is string => Boolean(value));

  const vars: Record<string, string> = {};
  for (const devVarsPath of paths) {
    if (!existsSync(devVarsPath)) continue;
    for (const line of readFileSync(devVarsPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      vars[trimmed.slice(0, separatorIndex).trim()] = trimmed
        .slice(separatorIndex + 1)
        .trim();
    }
  }
  return vars;
}

function applyDevVars(): void {
  for (const [key, value] of Object.entries(loadDevVars())) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function probeChat(apiKey: string, model: string): Promise<void> {
  const response = await fetch(`${VOLCANO_ARK_INFERENCE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 8,
    }),
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 300) };
  }

  const error = json.error as Record<string, unknown> | undefined;
  console.log(
    `model=${model} -> HTTP ${response.status} code=${String(error?.code ?? "ok")} msg=${String(error?.message ?? JSON.stringify(json).slice(0, 120))}`
  );
}

async function main(): Promise<void> {
  applyDevVars();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.SECRET_MASTER_KEY) {
    throw new Error("SECRET_MASTER_KEY is required");
  }

  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL });
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.provider, "doubao_volcano"))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("No doubao_volcano AI interface found");
  }

  const credentials = await getVolcanoCredentials(
    process.env as never,
    row.organizationId,
    row.metadata
  );
  if (!credentials) {
    throw new Error("Failed to decrypt volcano credentials");
  }

  console.log("Listing foundation models (glm filter)...");
  try {
    const list = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "ListFoundationModels",
      body: { PageNumber: 1, PageSize: 20, Filter: { Name: "glm" } },
    });
    const items = list.Items as Record<string, unknown>[] | undefined;
    console.log(`count=${items?.length ?? 0}`);
    for (const item of items ?? []) {
      console.log(
        `  Name=${item.Name} PrimaryVersion=${item.PrimaryVersion} DisplayName=${item.DisplayName}`
      );
      const name = String(item.Name ?? "");
      if (!name) continue;
      const versions = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action: "ListFoundationModelVersions",
        body: { FoundationModelName: name, PageNumber: 1, PageSize: 5 },
      });
      for (const version of (versions.Items as Record<string, unknown>[]) ?? []) {
        console.log(
          `    version=${version.ModelVersion} ModelId=${version.ModelId} Status=${version.Status}`
        );
      }
    }
  } catch (error) {
    console.log(
      `ListFoundationModels error: ${error instanceof Error ? error.message : error}`
    );
  }

  console.log("\nResolving Ark API key...");
  let apiKey = "";
  try {
    const ensured = await ensureVolcanoApiKey({
      env: process.env as never,
      organizationId: row.organizationId,
      metadataRaw: row.metadata,
      apiKeyEncrypted: row.apiKeyEncrypted,
    });
    apiKey = ensured.apiKey;
    console.log(
      `ensureVolcanoApiKey renewed=${ensured.renewed} hasKey=${Boolean(apiKey)}`
    );
  } catch (error) {
    console.log(
      `ensureVolcanoApiKey failed: ${error instanceof Error ? error.message : error}`
    );
  }

  if (!apiKey) {
    for (const [label, resourceType, resourceIds] of [
      ["foundation/glm", "foundationmodel", ["glm-5-2-260617"]],
      ["FoundationModel/glm", "FoundationModel", ["glm-5-2-260617"]],
    ] as const) {
      try {
        const result = await callVolcengineArkApi<Record<string, unknown>>({
          credentials,
          action: "GetApiKey",
          body: {
            DurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
            ResourceType: resourceType,
            ResourceIds: [...resourceIds],
            ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
          },
        });
        apiKey =
          (typeof result.ApiKey === "string" && result.ApiKey) ||
          (typeof result.apiKey === "string" && result.apiKey) ||
          "";
        if (apiKey) {
          console.log(`GetApiKey ${label} ok`);
          break;
        }
      } catch (error) {
        console.log(
          `GetApiKey ${label} failed: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  }

  if (!apiKey) {
    try {
      const issued = await getVolcanoArkApiKey(credentials);
      apiKey = issued.apiKey;
      console.log("getVolcanoArkApiKey() ok");
    } catch (error) {
      console.log(
        `getVolcanoArkApiKey() failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  if (!apiKey) {
    throw new Error("No Ark API key available");
  }
  console.log(`API key prefix: ${apiKey.slice(0, 8)}...`);

  console.log("\nProbing chat candidates...");
  for (const model of CANDIDATES) {
    await probeChat(apiKey, model);
  }

  console.log("\nProbing foundation ModelIds...");
  try {
    const list = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "ListFoundationModels",
      body: { PageNumber: 1, PageSize: 10, Filter: { Name: "glm" } },
    });
    for (const item of (list.Items as Record<string, unknown>[]) ?? []) {
      const name = String(item.Name ?? "");
      if (!name) continue;
      const versions = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action: "ListFoundationModelVersions",
        body: { FoundationModelName: name, PageNumber: 1, PageSize: 5 },
      });
      for (const version of (versions.Items as Record<string, unknown>[]) ?? []) {
        const modelId = String(version.ModelId ?? "");
        if (modelId) {
          await probeChat(apiKey, modelId);
        }
      }
    }
  } catch {
    // skip
  }
}

void main();
