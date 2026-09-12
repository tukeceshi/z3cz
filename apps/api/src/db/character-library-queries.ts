import type { CharacterLibraryEntry } from "@dafthunk/types";

import type { Database } from "../db";
import { mediaResources } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";

const CHARACTER_LIBRARY_SOURCE = "character_library";

function mapEntry(row: typeof mediaResources.$inferSelect): CharacterLibraryEntry {
  return {
    resourceId: row.id,
    kind: row.kind,
    mimeType: row.mimeType,
    modelCanonicalId: row.modelCanonicalId ?? null,
    interfaceId: row.interfaceId ?? null,
    createdAt: row.createdAt.toISOString(),
    upstreamAssetId: row.upstreamAssetId ?? null,
    upstreamAssetStatus: (row.upstreamAssetStatus as
      | "pending"
      | "active"
      | "failed"
      | null) ?? null,
  };
}

export async function getCharacterLibraryEntry(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<CharacterLibraryEntry | null> {
  const [row] = await db
    .select()
    .from(mediaResources)
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId)
      )
    )
    .limit(1);
  return row ? mapEntry(row) : null;
}

export async function setCharacterLibraryAssetImport(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
    readonly assetId: string | null;
    readonly status: "pending" | "active" | "failed";
  }
): Promise<void> {
  await db
    .update(mediaResources)
    .set({
      upstreamAssetId: params.assetId,
      upstreamAssetStatus: params.status,
    })
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId)
      )
    );
}

export async function listCharacterLibraryEntries(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly interfaceId?: string;
    readonly limit?: number;
  }
): Promise<readonly CharacterLibraryEntry[]> {
  const conditions = [
    eq(mediaResources.organizationId, params.organizationId),
    eq(mediaResources.source, CHARACTER_LIBRARY_SOURCE),
  ];
  if (params.interfaceId?.trim()) {
    conditions.push(eq(mediaResources.interfaceId, params.interfaceId.trim()));
  }

  const rows = await db
    .select()
    .from(mediaResources)
    .where(and(...conditions))
    .orderBy(desc(mediaResources.createdAt))
    .limit(params.limit ?? 200);

  return rows.map(mapEntry);
}

export async function addCharacterLibraryEntry(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
    readonly modelCanonicalId?: string;
    readonly interfaceId?: string;
  }
): Promise<CharacterLibraryEntry | null> {
  const [row] = await db
    .select()
    .from(mediaResources)
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  await db
    .update(mediaResources)
    .set({
      source: CHARACTER_LIBRARY_SOURCE,
      interfaceId: params.interfaceId?.trim() || row.interfaceId,
      modelCanonicalId:
        params.modelCanonicalId?.trim() || row.modelCanonicalId,
    })
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId)
      )
    );

  return {
    ...mapEntry(row),
    interfaceId: params.interfaceId?.trim() || row.interfaceId || null,
    modelCanonicalId:
      params.modelCanonicalId?.trim() || row.modelCanonicalId || null,
  };
}

export async function removeCharacterLibraryEntry(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(mediaResources)
    .set({ source: null })
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId),
        eq(mediaResources.source, CHARACTER_LIBRARY_SOURCE)
      )
    )
    .returning({ id: mediaResources.id });

  return result.length > 0;
}
