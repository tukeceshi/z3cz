/**
 * Inspect TOS-related resource packages for debugging usage meters.
 * Run: npx tsx scripts/probe-tos-packages.ts --from-db
 */
import { readFileSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";

import { createDatabase } from "../src/db";
import { organizationAiInterfaces } from "../src/db/schema";
import { getVolcanoCredentials } from "../src/integrations/volcengine/ensure-api-key";
import { fetchVolcanoResourcePackages } from "../src/integrations/volcengine/list-resource-packages";
import {
  buildTosPackageUsageFromRows,
  isTosStorageResourcePackage,
  isTosTrafficResourcePackage,
} from "../src/integrations/volcengine/tos-package-usage";

function loadSecrets(): void {
  for (const file of [
    process.env.SECRETS_FILE,
    process.env.DEV_VARS_FILE,
    ".dev.vars",
  ]) {
    if (!file || !existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i <= 0) continue;
      const key = trimmed.slice(0, i).trim();
      if (!process.env[key]) {
        process.env[key] = trimmed.slice(i + 1).trim();
      }
    }
  }
}

async function main(): Promise<void> {
  loadSecrets();
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL });
  const row = (
    await db
      .select()
      .from(organizationAiInterfaces)
      .where(eq(organizationAiInterfaces.provider, "doubao_volcano"))
      .limit(1)
  )[0];
  if (!row) {
    console.error("No volcano interface");
    process.exit(1);
  }

  const cred = await getVolcanoCredentials(
    process.env as never,
    row.organizationId,
    row.metadata
  );
  if (!cred) {
    console.error("No credentials");
    process.exit(1);
  }

  const fetched = await fetchVolcanoResourcePackages({
    credentials: cred,
    mode: "metering",
  });
  const resolved = { rows: fetched.rows };

  console.log("total packages:", resolved.rows.length);
  for (const r of resolved.rows) {
    const hay = [r.Product, r.ConfigurationCode, r.ConfigurationName]
      .join(" ")
      .toLowerCase();
    if (
      hay.includes("tos") ||
      hay.includes("对象") ||
      hay.includes("storage")
    ) {
      console.log(JSON.stringify(r));
    }
  }

  const storage = resolved.rows.filter(isTosStorageResourcePackage);
  const traffic = resolved.rows.filter(isTosTrafficResourcePackage);
  console.log("storage matches:", storage.length);
  console.log("traffic matches:", traffic.length);
  console.log("aggregated:", JSON.stringify(buildTosPackageUsageFromRows(resolved.rows)));
}

void main();
