import {
  CHARACTER_LIBRARY_SOURCE,
  type CharacterLibraryCategory,
  type CharacterLibraryCharacter,
  type CharacterLibraryEntry,
  characterLibraryCategoryFromMime,
  isCharacterLibraryCategory,
} from "@dafthunk/types";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db";
import {
  characterLibraryCharacterItems,
  characterLibraryCharacters,
  mediaResources,
} from "../db/schema";

function mapEntry(
  row: typeof mediaResources.$inferSelect
): CharacterLibraryEntry {
  return {
    resourceId: row.id,
    kind: row.kind,
    mimeType: row.mimeType,
    modelCanonicalId: row.modelCanonicalId ?? null,
    interfaceId: row.interfaceId ?? null,
    createdAt: row.createdAt.toISOString(),
    workflowId: row.sourceWorkflowId ?? null,
    category: isCharacterLibraryCategory(row.sourceCategory)
      ? row.sourceCategory
      : characterLibraryCategoryFromMime(row.mimeType),
    upstreamAssetId: row.upstreamAssetId ?? null,
    upstreamAssetStatus:
      (row.upstreamAssetStatus as "pending" | "active" | "failed" | null) ??
      null,
  };
}

function mapCharacter(
  row: typeof characterLibraryCharacters.$inferSelect,
  items: readonly CharacterLibraryEntry[]
): CharacterLibraryCharacter {
  return {
    id: row.id,
    name: row.name,
    workflowId: row.workflowId ?? null,
    createdAt: row.createdAt.toISOString(),
    items,
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

export type AddCharacterLibraryResult =
  | { readonly ok: true; readonly entry: CharacterLibraryEntry }
  | { readonly ok: false; readonly reason: "not_found" | "unsupported_type" };

export async function addCharacterLibraryEntry(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
    readonly modelCanonicalId?: string;
    readonly interfaceId?: string;
    readonly workflowId?: string;
    readonly category?: CharacterLibraryCategory;
  }
): Promise<AddCharacterLibraryResult> {
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
    return { ok: false, reason: "not_found" };
  }

  if (row.source === CHARACTER_LIBRARY_SOURCE) {
    return { ok: true, entry: mapEntry(row) };
  }

  const workflowId = params.workflowId?.trim() || null;
  const category =
    (isCharacterLibraryCategory(params.category) ? params.category : null) ??
    characterLibraryCategoryFromMime(row.mimeType);

  if (!category) {
    return { ok: false, reason: "unsupported_type" };
  }

  await db
    .update(mediaResources)
    .set({
      source: CHARACTER_LIBRARY_SOURCE,
      sourceWorkflowId: workflowId,
      sourceCategory: category,
      interfaceId: params.interfaceId?.trim() || row.interfaceId,
      modelCanonicalId: params.modelCanonicalId?.trim() || row.modelCanonicalId,
    })
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId)
      )
    );

  return {
    ok: true,
    entry: {
      ...mapEntry(row),
      workflowId,
      category,
      interfaceId: params.interfaceId?.trim() || row.interfaceId || null,
      modelCanonicalId:
        params.modelCanonicalId?.trim() || row.modelCanonicalId || null,
    },
  };
}

export async function removeCharacterLibraryEntry(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<boolean> {
  await db
    .delete(characterLibraryCharacterItems)
    .where(eq(characterLibraryCharacterItems.resourceId, params.resourceId));

  const result = await db
    .update(mediaResources)
    .set({ source: null, sourceWorkflowId: null, sourceCategory: null })
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

export async function listCharacterLibraryCharacters(
  db: Database,
  params: {
    readonly organizationId: string;
  }
): Promise<readonly CharacterLibraryCharacter[]> {
  const rows = await db
    .select()
    .from(characterLibraryCharacters)
    .where(eq(characterLibraryCharacters.organizationId, params.organizationId))
    .orderBy(desc(characterLibraryCharacters.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const itemRows = await db
    .select({
      characterId: characterLibraryCharacterItems.characterId,
      resource: mediaResources,
    })
    .from(characterLibraryCharacterItems)
    .innerJoin(
      mediaResources,
      eq(characterLibraryCharacterItems.resourceId, mediaResources.id)
    )
    .where(
      and(
        inArray(
          characterLibraryCharacterItems.characterId,
          rows.map((row) => row.id)
        ),
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.source, CHARACTER_LIBRARY_SOURCE)
      )
    )
    .orderBy(asc(characterLibraryCharacterItems.createdAt));

  const itemsByCharacter = new Map<string, CharacterLibraryEntry[]>();
  for (const item of itemRows) {
    const current = itemsByCharacter.get(item.characterId) ?? [];
    current.push(mapEntry(item.resource));
    itemsByCharacter.set(item.characterId, current);
  }

  return rows.map((row) =>
    mapCharacter(row, itemsByCharacter.get(row.id) ?? [])
  );
}

export async function createCharacterLibraryCharacter(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly name: string;
    readonly workflowId?: string;
  }
): Promise<CharacterLibraryCharacter | null> {
  const name = params.name.trim();
  if (!name) {
    return null;
  }

  const [row] = await db
    .insert(characterLibraryCharacters)
    .values({
      id: crypto.randomUUID(),
      organizationId: params.organizationId,
      workflowId: params.workflowId?.trim() || null,
      name,
    })
    .returning();

  return row ? mapCharacter(row, []) : null;
}

export async function deleteCharacterLibraryCharacter(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly characterId: string;
  }
): Promise<boolean> {
  const result = await db
    .delete(characterLibraryCharacters)
    .where(
      and(
        eq(characterLibraryCharacters.organizationId, params.organizationId),
        eq(characterLibraryCharacters.id, params.characterId)
      )
    )
    .returning({ id: characterLibraryCharacters.id });

  return result.length > 0;
}

export async function addCharacterLibraryCharacterItem(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly characterId: string;
    readonly resourceId: string;
  }
): Promise<CharacterLibraryCharacter | null> {
  const [character] = await db
    .select()
    .from(characterLibraryCharacters)
    .where(
      and(
        eq(characterLibraryCharacters.organizationId, params.organizationId),
        eq(characterLibraryCharacters.id, params.characterId)
      )
    )
    .limit(1);
  if (!character) {
    return null;
  }

  const [resource] = await db
    .select()
    .from(mediaResources)
    .where(
      and(
        eq(mediaResources.organizationId, params.organizationId),
        eq(mediaResources.id, params.resourceId),
        eq(mediaResources.source, CHARACTER_LIBRARY_SOURCE)
      )
    )
    .limit(1);
  if (!resource) {
    return null;
  }

  await db
    .insert(characterLibraryCharacterItems)
    .values({
      characterId: params.characterId,
      resourceId: params.resourceId,
    })
    .onConflictDoNothing();

  const characters = await listCharacterLibraryCharacters(db, {
    organizationId: params.organizationId,
  });
  return characters.find((row) => row.id === params.characterId) ?? null;
}

export async function removeCharacterLibraryCharacterItem(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly characterId: string;
    readonly resourceId: string;
  }
): Promise<boolean> {
  const [character] = await db
    .select({ id: characterLibraryCharacters.id })
    .from(characterLibraryCharacters)
    .where(
      and(
        eq(characterLibraryCharacters.organizationId, params.organizationId),
        eq(characterLibraryCharacters.id, params.characterId)
      )
    )
    .limit(1);
  if (!character) {
    return false;
  }

  const result = await db
    .delete(characterLibraryCharacterItems)
    .where(
      and(
        eq(characterLibraryCharacterItems.characterId, params.characterId),
        eq(characterLibraryCharacterItems.resourceId, params.resourceId)
      )
    )
    .returning({
      characterId: characterLibraryCharacterItems.characterId,
    });

  return result.length > 0;
}
