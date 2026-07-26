import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { signVolcengineRequest } from "../src/integrations/volcengine/signature";
import { VOLCANO_ARK_API_KEY_DURATION_SECONDS } from "@dafthunk/types";
import { VOLCANO_DEFAULT_PROJECT_NAME, VOLCANO_ARK_API_VERSION, VOLCANO_ARK_HOST, VOLCANO_ARK_SERVICE, VOLCANO_DEFAULT_REGION } from "../src/integrations/volcengine/constants";

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

async function main(): Promise<void> {
  applyDevVars();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL! });
  const row = (await db.select().from(organizationAiInterfaces).where(eq(organizationAiInterfaces.provider, "doubao_volcano")).limit(1))[0]!;
  const credentials = (await getVolcanoCredentials(process.env as never, row.organizationId, row.metadata))!;

  const endpointId = process.argv[2] ?? "ep-20260722212100-brzwk";
  const body = {
    DurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
    ResourceType: "endpoint",
    ResourceIds: [endpointId],
    ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
  };

  console.log("body", JSON.stringify(body));

  // via callVolcengineArkApi
  try {
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "GetApiKey",
      body,
    });
    console.log("callVolcengineArkApi OK", JSON.stringify(result).slice(0, 300));
  } catch (error) {
    console.log("callVolcengineArkApi FAIL", error instanceof Error ? error.message : error);
  }

  // raw signed request
  const signed = await signVolcengineRequest({
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    region: credentials.region ?? VOLCANO_DEFAULT_REGION,
    service: VOLCANO_ARK_SERVICE,
    host: VOLCANO_ARK_HOST,
    method: "POST",
    action: "GetApiKey",
    version: VOLCANO_ARK_API_VERSION,
    body,
  });
  console.log("signed body", signed.body);
  const raw = await fetch(signed.url, { method: "POST", headers: signed.headers, body: signed.body });
  const text = await raw.text();
  console.log("raw status", raw.status, text.slice(0, 500));

  // try alternate action casing / query only duration
  for (const variant of [
    { label: "query DurationSeconds only", queryParams: { DurationSeconds: String(VOLCANO_ARK_API_KEY_DURATION_SECONDS) }, body: { ResourceType: "endpoint", ResourceIds: [endpointId], ProjectName: VOLCANO_DEFAULT_PROJECT_NAME } },
    { label: "duration_seconds snake", body: { duration_seconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS, resource_type: "endpoint", resource_ids: [endpointId], project_name: VOLCANO_DEFAULT_PROJECT_NAME } },
  ] as const) {
    try {
      const result = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action: "GetApiKey",
        body: variant.body as Record<string, unknown>,
        queryParams: "queryParams" in variant ? variant.queryParams : undefined,
      });
      console.log(`OK ${variant.label}`, JSON.stringify(result).slice(0, 200));
    } catch (error) {
      console.log(`FAIL ${variant.label}`, error instanceof Error ? error.message : error);
    }
  }
}

void main();
