import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { callVolcengineArkApi } from "../src/integrations/volcengine/client";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { listVolcanoEndpointIds } from "../src/integrations/volcengine/list-endpoints";

function applyDevVars(): void {
  for (const p of [process.env.SECRETS_FILE, resolve(process.cwd(), ".dev.vars")].filter(Boolean)) {
    if (!p || !existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
}

async function main(): Promise<void> {
  applyDevVars();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL! });
  const row = (await db.select().from(organizationAiInterfaces).where(eq(organizationAiInterfaces.provider, "doubao_volcano")).limit(1))[0]!;
  const credentials = (await getVolcanoCredentials(process.env as never, row.organizationId, row.metadata))!;
  const ids = await listVolcanoEndpointIds(credentials);
  for (const id of ids) {
    for (const action of ["GetEndpoint", "GetInferenceEndpoint"]) {
      try {
        const result = await callVolcengineArkApi<Record<string, unknown>>({
          credentials,
          action,
          body: { Id: id },
        });
        console.log(action, id, JSON.stringify(result).slice(0, 500));
      } catch (error) {
        console.log("FAIL", action, id, error instanceof Error ? error.message : error);
      }
    }
  }
}

void main();
