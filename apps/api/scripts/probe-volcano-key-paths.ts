/**
 * Probe Ark API key / endpoint creation paths for deferred-key accounts.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import {
  VOLCANO_ARK_API_KEY_DURATION_SECONDS,
  VOLCANO_DEFAULT_PROJECT_NAME,
} from "../src/integrations/volcengine/constants";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { extractVolcanoListItems } from "../src/integrations/volcengine/list-endpoints";

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

async function tryCall(
  label: string,
  credentials: NonNullable<Awaited<ReturnType<typeof getVolcanoCredentials>>>,
  action: string,
  body: Record<string, unknown> = {},
  queryParams?: Record<string, string>
): Promise<Record<string, unknown> | null> {
  try {
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action,
      body,
      queryParams,
    });
    console.log(`\nOK ${label}`);
    console.log(JSON.stringify(result, null, 2).slice(0, 2000));
    return result;
  } catch (error) {
    console.log(
      `\nFAIL ${label}: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

async function main(): Promise<void> {
  applyDevVars();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL! });
  const row = (
    await db
      .select()
      .from(organizationAiInterfaces)
      .where(eq(organizationAiInterfaces.provider, "doubao_volcano"))
      .limit(1)
  )[0]!;

  const credentials = (await getVolcanoCredentials(
    process.env as never,
    row.organizationId,
    row.metadata
  ))!;

  const listEndpoints = await tryCall(
    "ListEndpoints full",
    credentials,
    "ListEndpoints",
    { PageNumber: 1, PageSize: 20, ProjectName: VOLCANO_DEFAULT_PROJECT_NAME }
  );
  if (listEndpoints) {
    const items = extractVolcanoListItems(listEndpoints);
    console.log(`endpoint items=${items.length}`);
    for (const item of items.slice(0, 5)) {
      console.log(JSON.stringify(item).slice(0, 400));
    }
  }

  await tryCall("ListPresetEndpoints", credentials, "ListPresetEndpoints", {
    PageNumber: 1,
    PageSize: 20,
    ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
  });

  await tryCall("ListInferenceEndpoints", credentials, "ListInferenceEndpoints", {
    PageNumber: 1,
    PageSize: 20,
  });

  await tryCall("CreateApiKey", credentials, "CreateApiKey", {
    Name: "dafthunk-probe",
    ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
  });

  await tryCall(
    "CreateEndpoint glm-5-2",
    credentials,
    "CreateEndpoint",
    {
      Name: "dafthunk-glm-probe",
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
      ModelReference: {
        FoundationModel: {
          Name: "glm-5-2",
          ModelVersion: "260617",
        },
      },
    }
  );

  await tryCall(
    "GetApiKey endpoint test",
    credentials,
    "GetApiKey",
    {
      DurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
      ResourceType: "endpoint",
      ResourceIds: ["ep-probe-placeholder"],
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
    { DurationSeconds: String(VOLCANO_ARK_API_KEY_DURATION_SECONDS) }
  );
}

void main();
