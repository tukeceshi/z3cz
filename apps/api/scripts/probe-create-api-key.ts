import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
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

async function main(): Promise<void> {
  applyDevVars();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL! });
  const row = (await db.select().from(organizationAiInterfaces).where(eq(organizationAiInterfaces.provider, "doubao_volcano")).limit(1))[0]!;
  const credentials = (await getVolcanoCredentials(process.env as never, row.organizationId, row.metadata))!;

  for (const body of [
    { Name: "dafthunk-probe", ProjectName: VOLCANO_DEFAULT_PROJECT_NAME, ResourceInstances: ["*"] },
    { Name: "dafthunk-probe2", ProjectName: VOLCANO_DEFAULT_PROJECT_NAME, ResourceInstances: [{ ResourceType: "endpoint", ResourceId: "ep-20260722212100-brzwk" }] },
    { Name: "dafthunk-probe3", ProjectName: VOLCANO_DEFAULT_PROJECT_NAME, ResourceInstances: [{ ResourceType: "endpoint", ResourceIds: ["ep-20260722212100-brzwk"] }] },
  ]) {
    try {
      const result = await callVolcengineArkApi<Record<string, unknown>>({ credentials, action: "CreateApiKey", body });
      console.log("CreateApiKey OK", JSON.stringify(result).slice(0, 400));
      const apiKey = String(result.ApiKey ?? result.apiKey ?? result.Key ?? "");
      if (apiKey) {
        const res = await fetch(`${VOLCANO_ARK_INFERENCE_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "glm-5-2-260617", messages: [{ role: "user", content: "hi" }], max_tokens: 8 }),
        });
        console.log("chat with model id", res.status, (await res.text()).slice(0, 200));
      }
    } catch (error) {
      console.log("CreateApiKey FAIL", JSON.stringify(body), error instanceof Error ? error.message : error);
    }
  }
}

void main();
