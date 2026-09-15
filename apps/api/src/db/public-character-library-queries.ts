import type { PublicCharacterLibraryGroup } from "@dafthunk/types";
import { desc, ilike, inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "../db";
import { platformPublicCharacterLibrary } from "../db/schema";

type PublicCharacterLibraryRow =
  typeof platformPublicCharacterLibrary.$inferSelect;

function flattenGroups(
  groups: readonly PublicCharacterLibraryGroup[]
): readonly {
  readonly assetId: string;
  readonly groupSid: string;
  readonly name: string;
  readonly imageUrl: string;
  readonly gender: string | null;
  readonly age: number | null;
  readonly country: string | null;
  readonly sortIndex: number;
}[] {
  const byAsset = new Map<
    string,
    {
      readonly assetId: string;
      readonly groupSid: string;
      readonly name: string;
      readonly imageUrl: string;
      readonly gender: string | null;
      readonly age: number | null;
      readonly country: string | null;
      readonly sortIndex: number;
    }
  >();
  for (const group of groups) {
    group.items.forEach((item, index) => {
      byAsset.set(item.assetId, {
        assetId: item.assetId,
        groupSid: group.groupId,
        name: group.name,
        imageUrl: item.imageUrl,
        gender: group.gender ?? null,
        age: group.age ?? null,
        country: group.country ?? null,
        sortIndex: index,
      });
    });
  }
  return [...byAsset.values()];
}

function assembleGroups(
  rows: readonly PublicCharacterLibraryRow[],
  order: readonly string[]
): readonly PublicCharacterLibraryGroup[] {
  const byGroup = new Map<string, PublicCharacterLibraryRow[]>();
  for (const row of rows) {
    const current = byGroup.get(row.groupSid);
    if (current) {
      current.push(row);
    } else {
      byGroup.set(row.groupSid, [row]);
    }
  }
  return order.flatMap((groupSid) => {
    const items = (byGroup.get(groupSid) ?? []).sort(
      (left, right) => left.sortIndex - right.sortIndex
    );
    const cover = items[0];
    if (!cover) {
      return [];
    }
    return [
      {
        groupId: groupSid,
        name: cover.name,
        imageUrl: cover.imageUrl,
        gender: cover.gender,
        age: cover.age,
        country: cover.country,
        items: items.map((item) => ({
          assetId: item.assetId,
          imageUrl: item.imageUrl,
        })),
      },
    ];
  });
}

export async function listPublicCharacterLibraryGroups(
  db: Database,
  params: {
    readonly offset: number;
    readonly limit: number;
    readonly query?: string;
  }
): Promise<{
  readonly groups: readonly PublicCharacterLibraryGroup[];
  readonly total: number;
}> {
  const query = params.query?.trim();
  const where = query
    ? ilike(platformPublicCharacterLibrary.name, `%${query}%`)
    : undefined;

  const [countRow] = await db
    .select({
      count: sql<number>`count(distinct ${platformPublicCharacterLibrary.groupSid})::int`,
    })
    .from(platformPublicCharacterLibrary)
    .where(where);

  const groupPage = await db
    .select({
      groupSid: platformPublicCharacterLibrary.groupSid,
      syncedAt: sql<Date>`max(${platformPublicCharacterLibrary.syncedAt})`.as(
        "synced_at"
      ),
    })
    .from(platformPublicCharacterLibrary)
    .where(where)
    .groupBy(platformPublicCharacterLibrary.groupSid)
    .orderBy(
      desc(sql`max(${platformPublicCharacterLibrary.syncedAt})`),
      desc(platformPublicCharacterLibrary.groupSid)
    )
    .offset(params.offset)
    .limit(params.limit);

  const groupSids = groupPage.map((row) => row.groupSid);
  if (groupSids.length === 0) {
    return { groups: [], total: countRow?.count ?? 0 };
  }

  const itemRows = await db
    .select()
    .from(platformPublicCharacterLibrary)
    .where(inArray(platformPublicCharacterLibrary.groupSid, groupSids));

  return {
    groups: assembleGroups(itemRows, groupSids),
    total: countRow?.count ?? 0,
  };
}

export async function getPublicCharacterLibrarySyncMeta(
  db: Database
): Promise<{ readonly total: number; readonly lastSyncedAt: string | null }> {
  const [row] = await db
    .select({
      total: sql<number>`count(distinct ${platformPublicCharacterLibrary.groupSid})::int`,
      lastSyncedAt: sql<Date | null>`max(${platformPublicCharacterLibrary.syncedAt})`,
    })
    .from(platformPublicCharacterLibrary);
  return {
    total: row?.total ?? 0,
    lastSyncedAt: row?.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  };
}

export async function replacePublicCharacterLibraryGroups(
  db: Database,
  groups: readonly PublicCharacterLibraryGroup[]
): Promise<{ readonly upserted: number; readonly removed: number }> {
  const syncedAt = new Date();
  const rows = flattenGroups(groups);
  const assetIds = rows.map((row) => row.assetId);

  if (rows.length > 0) {
    const chunkSize = 200;
    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      await db
        .insert(platformPublicCharacterLibrary)
        .values(
          chunk.map((row) => ({
            assetId: row.assetId,
            name: row.name,
            imageUrl: row.imageUrl,
            gender: row.gender,
            age: row.age,
            country: row.country,
            groupSid: row.groupSid,
            sortIndex: row.sortIndex,
            syncedAt,
          }))
        )
        .onConflictDoUpdate({
          target: platformPublicCharacterLibrary.assetId,
          set: {
            name: sql`excluded.name`,
            imageUrl: sql`excluded.image_url`,
            gender: sql`excluded.gender`,
            age: sql`excluded.age`,
            country: sql`excluded.country`,
            groupSid: sql`excluded.group_sid`,
            sortIndex: sql`excluded.sort_index`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }
  }

  const deleted = assetIds.length
    ? await db
        .delete(platformPublicCharacterLibrary)
        .where(notInArray(platformPublicCharacterLibrary.assetId, assetIds))
        .returning({ assetId: platformPublicCharacterLibrary.assetId })
    : await db
        .delete(platformPublicCharacterLibrary)
        .returning({ assetId: platformPublicCharacterLibrary.assetId });

  return {
    upserted: groups.length,
    removed: deleted.length,
  };
}
