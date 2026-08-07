import type { MediaResourceKind, MediaResourceRecord } from "@dafthunk/types";

import type { Database } from "../db";
import { mediaResources } from "../db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";

export interface UpsertMediaResourceParams {
  readonly id: string;
  readonly organizationId: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly storageKey?: string | null;
}

function mapMediaResourceRow(
  row: typeof mediaResources.$inferSelect
): MediaResourceRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function upsertMediaResources(
  db: Database,
  resources: readonly UpsertMediaResourceParams[]
): Promise<void> {
  if (resources.length === 0) {
    return;
  }

  await db
    .insert(mediaResources)
    .values(
      resources.map((resource) => ({
        id: resource.id,
        organizationId: resource.organizationId,
        kind: resource.kind,
        mimeType: resource.mimeType,
        storageKey: resource.storageKey ?? null,
      }))
    )
    .onConflictDoUpdate({
      target: mediaResources.id,
      set: {
        kind: sql`excluded.kind`,
        mimeType: sql`excluded.mime_type`,
        storageKey: sql`excluded.storage_key`,
      },
    });
}

export async function rekeyMediaResource(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly fromResourceId: string;
    readonly toResourceId: string;
    readonly kind: MediaResourceKind;
    readonly mimeType: string;
    readonly storageKey?: string | null;
  }
): Promise<void> {
  const fromResourceId = params.fromResourceId.trim();
  const toResourceId = params.toResourceId.trim();
  if (!fromResourceId || !toResourceId) {
    return;
  }

  if (fromResourceId === toResourceId) {
    await upsertMediaResources(db, [
      {
        id: toResourceId,
        organizationId: params.organizationId,
        kind: params.kind,
        mimeType: params.mimeType,
        storageKey: params.storageKey ?? null,
      },
    ]);
    return;
  }

  const [fromRow] = await db
    .select()
    .from(mediaResources)
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, fromResourceId)
      )
    )
    .limit(1);

  await db
    .delete(mediaResources)
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, toResourceId)
      )
    );

  if (fromRow) {
    await db
      .update(mediaResources)
      .set({
        id: toResourceId,
        kind: params.kind,
        mimeType: params.mimeType,
        storageKey: params.storageKey ?? null,
      })
      .where(
        and(
          eq(mediaResources.organizationId, params.organizationId),
          eq(mediaResources.id, fromResourceId)
        )
      );
    return;
  }

  await upsertMediaResources(db, [
    {
      id: toResourceId,
      organizationId: params.organizationId,
      kind: params.kind,
      mimeType: params.mimeType,
      storageKey: params.storageKey ?? null,
    },
  ]);
}

export async function getMediaResourcesByIds(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceIds: readonly string[];
  }
): Promise<readonly MediaResourceRecord[]> {
  if (params.resourceIds.length === 0) {
    return [];
  }

  const ids = [...params.resourceIds];
  const rows = await db
    .select()
    .from(mediaResources)
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        or(
          inArray(mediaResources.id, ids),
          inArray(mediaResources.storageKey, ids)
        )
      )
    );

  return rows.map(mapMediaResourceRow);
}
