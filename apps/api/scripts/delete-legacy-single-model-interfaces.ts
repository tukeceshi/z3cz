/**
 * Deletes legacy single-model AI interfaces (one row per model).
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @dafthunk/api exec tsx scripts/delete-legacy-single-model-interfaces.ts
 *   ORGANIZATION_ID=<uuid> ...  # optional scope
 */
import { eq } from "drizzle-orm";
import { isLegacySingleModelMetadata } from "@dafthunk/types";

import { createDatabase } from "../src/db";
import { deleteOrganizationAiInterface } from "../src/db/ai-interface-queries";
import { organizationAiInterfaces } from "../src/db/schema";

function parseInterfaceMetadata(raw: string | null): unknown {
  if (!raw?.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const organizationId = process.env.ORGANIZATION_ID?.trim();
  const db = createDatabase(process.env as import("../src/context").DatabaseEnv);

  const rows = organizationId
    ? await db
        .select()
        .from(organizationAiInterfaces)
        .where(eq(organizationAiInterfaces.organizationId, organizationId))
    : await db.select().from(organizationAiInterfaces);

  let deleted = 0;

  for (const row of rows) {
    if (row.provider !== "custom") {
      continue;
    }
    const metadata = parseInterfaceMetadata(row.metadata);
    if (!isLegacySingleModelMetadata(metadata)) {
      continue;
    }

    console.log(`[delete] org=${row.organizationId} id=${row.id} name=${row.name}`);
    await deleteOrganizationAiInterface(db, row.organizationId, row.id);
    deleted += 1;
  }

  console.log(`Done. Deleted ${deleted} legacy interface(s).`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
