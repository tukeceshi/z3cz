import type {
  CreatePlatformRelayAccountRequest,
  PlatformRelayAccount,
  RelayAccountProvider,
  UpdatePlatformRelayAccountRequest,
} from "@dafthunk/types";
import { and, asc, eq, ne } from "drizzle-orm";

import type { Database } from "./index";
import {
  platformRelayAccounts,
  RelayAccountProvider as RelayAccountProviderEnum,
} from "./schema";

function rowToPlatformRelayAccount(
  row: typeof platformRelayAccounts.$inferSelect
): PlatformRelayAccount {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as RelayAccountProvider,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    isDefault: row.isDefault,
    hasApiKey: row.apiKeyEncrypted.length > 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

async function clearDefaultRelayAccount(
  db: Database,
  provider: RelayAccountProvider,
  exceptId?: string
): Promise<void> {
  const conditions = [
    eq(platformRelayAccounts.provider, provider),
    eq(platformRelayAccounts.isDefault, true),
  ];
  if (exceptId) {
    conditions.push(ne(platformRelayAccounts.id, exceptId));
  }

  await db
    .update(platformRelayAccounts)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(...conditions));
}

export async function listPlatformRelayAccounts(
  db: Database
): Promise<PlatformRelayAccount[]> {
  const rows = await db
    .select()
    .from(platformRelayAccounts)
    .orderBy(
      asc(platformRelayAccounts.isDefault),
      asc(platformRelayAccounts.name)
    );

  return rows.map(rowToPlatformRelayAccount);
}

export async function getPlatformRelayAccountById(
  db: Database,
  id: string
): Promise<PlatformRelayAccount | undefined> {
  const [row] = await db
    .select()
    .from(platformRelayAccounts)
    .where(eq(platformRelayAccounts.id, id))
    .limit(1);

  return row ? rowToPlatformRelayAccount(row) : undefined;
}

export async function getPlatformRelayAccountRowById(
  db: Database,
  id: string
): Promise<typeof platformRelayAccounts.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(platformRelayAccounts)
    .where(eq(platformRelayAccounts.id, id))
    .limit(1);

  return row;
}

export async function getDefaultPlatformRelayAccountRow(
  db: Database,
  provider: RelayAccountProvider = RelayAccountProviderEnum.NEWAPI
): Promise<typeof platformRelayAccounts.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(platformRelayAccounts)
    .where(
      and(
        eq(platformRelayAccounts.provider, provider),
        eq(platformRelayAccounts.enabled, true),
        eq(platformRelayAccounts.isDefault, true)
      )
    )
    .limit(1);

  return row;
}

export async function createPlatformRelayAccount(
  db: Database,
  input: CreatePlatformRelayAccountRequest & { id: string; apiKeyEncrypted: string },
  updatedBy: string
): Promise<PlatformRelayAccount> {
  if (input.isDefault) {
    await clearDefaultRelayAccount(db, input.provider);
  }

  const now = new Date();
  const [row] = await db
    .insert(platformRelayAccounts)
    .values({
      id: input.id,
      name: input.name,
      provider: input.provider,
      baseUrl: input.baseUrl.replace(/\/$/, ""),
      apiKeyEncrypted: input.apiKeyEncrypted,
      enabled: input.enabled ?? true,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
      updatedBy,
    })
    .returning();

  return rowToPlatformRelayAccount(row);
}

export async function updatePlatformRelayAccount(
  db: Database,
  id: string,
  input: UpdatePlatformRelayAccountRequest & { apiKeyEncrypted?: string },
  updatedBy: string
): Promise<PlatformRelayAccount> {
  const existing = await getPlatformRelayAccountRowById(db, id);
  if (!existing) {
    throw new Error("Relay account not found");
  }

  if (input.isDefault) {
    await clearDefaultRelayAccount(
      db,
      existing.provider as RelayAccountProvider,
      id
    );
  }

  const [row] = await db
    .update(platformRelayAccounts)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.baseUrl !== undefined
        ? { baseUrl: input.baseUrl.replace(/\/$/, "") }
        : {}),
      ...(input.apiKeyEncrypted !== undefined
        ? { apiKeyEncrypted: input.apiKeyEncrypted }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      updatedAt: new Date(),
      updatedBy,
    })
    .where(eq(platformRelayAccounts.id, id))
    .returning();

  return rowToPlatformRelayAccount(row);
}

export async function deletePlatformRelayAccount(
  db: Database,
  id: string
): Promise<void> {
  const existing = await getPlatformRelayAccountRowById(db, id);
  if (!existing) {
    throw new Error("Relay account not found");
  }

  if (existing.isDefault) {
    throw new Error("Cannot delete the default relay account");
  }

  await db.delete(platformRelayAccounts).where(eq(platformRelayAccounts.id, id));
}
