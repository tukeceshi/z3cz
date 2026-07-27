import { eq } from "drizzle-orm";

import type { Database } from "./index";
import { aiInterfaceCreateIdempotency } from "./schema";

export interface CreateIdempotencyRecord {
  readonly key: string;
  readonly organizationId: string;
  readonly interfaceId: string;
}

export async function getCreateIdempotencyRecord(
  db: Database,
  key: string
): Promise<CreateIdempotencyRecord | null> {
  const [row] = await db
    .select()
    .from(aiInterfaceCreateIdempotency)
    .where(eq(aiInterfaceCreateIdempotency.key, key))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    key: row.key,
    organizationId: row.organizationId,
    interfaceId: row.interfaceId,
  };
}

export async function insertCreateIdempotencyRecord(
  db: Database,
  record: CreateIdempotencyRecord
): Promise<boolean> {
  const result = await db
    .insert(aiInterfaceCreateIdempotency)
    .values({
      key: record.key,
      organizationId: record.organizationId,
      interfaceId: record.interfaceId,
    })
    .onConflictDoNothing()
    .returning({ key: aiInterfaceCreateIdempotency.key });

  return result.length > 0;
}
