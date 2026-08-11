import type {
  AiModelCatalogEntry,
  AiModelModality,
  PlatformAiModelChannelKind,
  PlatformAiModelChannelOption,
} from "@dafthunk/types";
import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../db";
import {
  platformAiModelChannels,
  platformAiModels,
} from "../db/schema";

export interface ListPlatformAiModelChannelsParams {
  readonly channel?: PlatformAiModelChannelKind;
  readonly presetId?: string;
  readonly modality?: AiModelModality;
}

export async function listPlatformAiModelChannels(
  db: Database,
  params: ListPlatformAiModelChannelsParams = {}
): Promise<readonly PlatformAiModelChannelOption[]> {
  const conditions = [eq(platformAiModels.platformEnabled, true)];

  if (params.channel) {
    conditions.push(eq(platformAiModelChannels.channel, params.channel));
  }
  if (params.presetId) {
    conditions.push(eq(platformAiModelChannels.presetId, params.presetId));
  }
  if (params.modality) {
    conditions.push(eq(platformAiModels.modality, params.modality));
  }

  const rows = await db
    .select({
      canonicalId: platformAiModelChannels.canonicalId,
      displayName: platformAiModels.displayName,
      modality: platformAiModels.modality,
      channel: platformAiModelChannels.channel,
      presetId: platformAiModelChannels.presetId,
      upstreamModelId: platformAiModelChannels.upstreamModelId,
      brandIcon: platformAiModels.brandIcon,
      sortOrder: platformAiModels.sortOrder,
      channelEnabled: platformAiModelChannels.channelEnabled,
    })
    .from(platformAiModelChannels)
    .innerJoin(
      platformAiModels,
      eq(platformAiModelChannels.canonicalId, platformAiModels.canonicalId)
    )
    .where(and(...conditions, eq(platformAiModelChannels.channelEnabled, true)))
    .orderBy(asc(platformAiModels.sortOrder), asc(platformAiModels.displayName));

  return rows.map((row) => ({
    canonicalId: row.canonicalId,
    displayName: row.displayName,
    modality: row.modality as AiModelModality,
    channel: row.channel as PlatformAiModelChannelKind,
    presetId: row.presetId,
    upstreamModelId: row.upstreamModelId,
    brandIcon: row.brandIcon,
    sortOrder: row.sortOrder,
  }));
}

export async function listAggregateVolcanoCatalogEntries(
  db: Database
): Promise<readonly AiModelCatalogEntry[]> {
  const rows = await listPlatformAiModelChannels(db, {
    channel: "aggregate",
    presetId: "aggregate:volcano",
  });

  return rows.map((row) => ({
    canonicalId: row.canonicalId,
    alias: row.displayName,
    modality: row.modality,
    providerModelId: row.upstreamModelId,
  }));
}

export async function listApiChannelCanonicalIdsForPreset(
  db: Database,
  presetId: string,
  modality?: AiModelModality
): Promise<readonly string[]> {
  const rows = await listPlatformAiModelChannels(db, {
    channel: "api",
    presetId,
    modality,
  });
  return rows.map((row) => row.canonicalId);
}
