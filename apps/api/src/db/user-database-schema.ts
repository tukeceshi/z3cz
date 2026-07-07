import { sql } from "drizzle-orm";

import type { Database } from "./index";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getUserDatabaseSchemaName(databaseId: string): string {
  if (!UUID_PATTERN.test(databaseId)) {
    throw new Error(`Invalid user database id: ${databaseId}`);
  }
  return `udb_${databaseId.replace(/-/g, "_")}`;
}

export async function ensureUserDatabaseSchema(
  db: Database,
  databaseId: string
): Promise<void> {
  const schemaName = getUserDatabaseSchemaName(databaseId);
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`));
}

export async function dropUserDatabaseSchema(
  db: Database,
  databaseId: string
): Promise<void> {
  const schemaName = getUserDatabaseSchemaName(databaseId);
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`));
}
