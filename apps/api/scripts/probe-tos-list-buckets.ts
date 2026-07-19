/**
 * Live probe for Volcano TOS ListBuckets via our client.
 *
 * Usage (credentials):
 *   VOLC_AK=... VOLC_SK=... npx tsx scripts/probe-tos-list-buckets.ts
 *
 * Usage (DB-backed, same path as API route):
 *   npx tsx scripts/probe-tos-list-buckets.ts --from-db
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { VolcengineTosClient } from "../src/integrations/volcengine/tos-client";

const REGIONS = [
  "cn-guangzhou",
  "cn-beijing",
  "cn-shanghai",
  "ap-southeast-1",
  "ap-southeast-3",
] as const;

function loadDevVars(): Record<string, string> {
  const paths = [
    process.env.SECRETS_FILE,
    process.env.DEV_VARS_FILE,
    resolve(process.cwd(), ".dev.vars"),
  ].filter((value): value is string => Boolean(value));

  const vars: Record<string, string> = {};
  for (const devVarsPath of paths) {
    if (!existsSync(devVarsPath)) {
      continue;
    }

    for (const line of readFileSync(devVarsPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      vars[key] = value;
    }
  }
  return vars;
}

function applyDevVars(): void {
  const vars = loadDevVars();
  for (const [key, value] of Object.entries(vars)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function probeRegion(params: {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
}): Promise<void> {
  const client = VolcengineTosClient.forRegion(params);
  const buckets = await client.listBuckets();
  console.log(`  ${params.region}: ${buckets.length} bucket(s)`);
  for (const bucket of buckets.slice(0, 5)) {
    console.log(`    - ${bucket}`);
  }
}

async function loadCredentialsFromDb(): Promise<{
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly organizationId: string;
  readonly interfaceId: string;
}> {
  applyDevVars();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for --from-db");
  }
  if (!process.env.SECRET_MASTER_KEY) {
    throw new Error("SECRET_MASTER_KEY is required for --from-db");
  }

  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL });
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.provider, "doubao_volcano"))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("No doubao_volcano AI interface found in database");
  }

  const credentials = await getVolcanoCredentials(
    process.env as never,
    row.organizationId,
    row.metadata
  );
  if (!credentials) {
    throw new Error("Failed to decrypt volcano credentials from interface metadata");
  }

  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    organizationId: row.organizationId,
    interfaceId: row.id,
  };
}

async function main(): Promise<void> {
  applyDevVars();
  const fromDb = process.argv.includes("--from-db");

  let accessKeyId = process.env.VOLC_AK ?? "";
  let secretAccessKey = process.env.VOLC_SK ?? "";

  if (fromDb || (!accessKeyId && !secretAccessKey)) {
    console.log("Loading volcano credentials from database...");
    const loaded = await loadCredentialsFromDb();
    accessKeyId = loaded.accessKeyId;
    secretAccessKey = loaded.secretAccessKey;
    console.log(
      `Using interface ${loaded.interfaceId} in org ${loaded.organizationId}`
    );
  }

  if (!accessKeyId || !secretAccessKey) {
    console.error(
      "Set VOLC_AK/VOLC_SK or run with --from-db and configured DATABASE_URL + SECRET_MASTER_KEY"
    );
    process.exit(1);
  }

  console.log(`Access key prefix: ${accessKeyId.slice(0, 6)}...`);

  let successCount = 0;
  for (const region of REGIONS) {
    try {
      await probeRegion({ accessKeyId, secretAccessKey, region });
      successCount += 1;
    } catch (error) {
      console.error(
        `  ${region}: FAIL — ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (successCount === 0) {
    console.error("All regions failed.");
    process.exit(1);
  }

  console.log(`Done. ${successCount}/${REGIONS.length} regions succeeded.`);
}

void main();
