import { and, asc, desc, eq, sql } from "drizzle-orm";

import type {
  AiModelInvocation,
  AiModelModality,
  CreatePlatformAiModelGroupRequest,
  ListAiModelInvocationsResponse,
  OrganizationModelInterfacePriority,
  PlatformAiModel,
  PlatformAiModelGroup,
  PlatformAiModelParameterRules,
  TextModelParameterRules,
  UpdatePlatformAiModelGroupRequest,
  UpdatePlatformAiModelRequest,
} from "@dafthunk/types";
import {
  DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
  DEFAULT_TEXT_MODEL_PARAMETER_RULES,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  isImageModelParameterRules,
  isTextModelParameterRules,
  isVideoModelParameterRules,
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
  type ImageModelParameterRules,
  type VideoModelParameterRules,
} from "@dafthunk/types";

import type { Database } from "./index";
import { parseJsonColumn } from "./parse-json-column";
import {
  aiModelInvocations,
  organizationModelInterfacePriorities,
  platformAiModelGroups,
  platformAiModels,
} from "./schema";

function mapPlatformModelRow(
  row: typeof platformAiModels.$inferSelect
): PlatformAiModel {
  return {
    canonicalId: row.canonicalId,
    displayName: row.displayName,
    modality: row.modality as AiModelModality,
    platformEnabled: row.platformEnabled,
    providerModelId: row.providerModelId,
    parameterRules: parseJsonColumn<PlatformAiModelParameterRules>(
      row.parameterRules
    ),
    sortOrder: row.sortOrder,
    groupId: row.groupId ?? null,
    description: row.description ?? "",
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function mapPlatformGroupRow(
  row: typeof platformAiModelGroups.$inferSelect
): PlatformAiModelGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function mapInvocationRow(
  row: typeof aiModelInvocations.$inferSelect
): AiModelInvocation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    canonicalId: row.canonicalId,
    displayName: row.displayName,
    interfaceId: row.interfaceId,
    interfaceName: row.interfaceName,
    promptExcerpt: row.promptExcerpt,
    content: row.content,
    source: row.source,
    status: row.status as AiModelInvocation["status"],
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPlatformAiModels(
  db: Database,
  modality?: AiModelModality
): Promise<readonly PlatformAiModel[]> {
  const rows = await db
    .select()
    .from(platformAiModels)
    .where(modality ? eq(platformAiModels.modality, modality) : undefined)
    .orderBy(asc(platformAiModels.sortOrder));

  return rows.map(mapPlatformModelRow);
}

export async function getPlatformAiModel(
  db: Database,
  canonicalId: string
): Promise<PlatformAiModel | null> {
  const rows = await db
    .select()
    .from(platformAiModels)
    .where(eq(platformAiModels.canonicalId, canonicalId))
    .limit(1);

  const row = rows[0];
  return row ? mapPlatformModelRow(row) : null;
}

export async function updatePlatformAiModel(
  db: Database,
  canonicalId: string,
  patch: UpdatePlatformAiModelRequest
): Promise<PlatformAiModel | null> {
  const existing = await getPlatformAiModel(db, canonicalId);
  if (!existing) return null;

  const nextRulesRaw = patch.parameterRules ?? existing.parameterRules;
  const nextRules = isTextModelParameterRules(nextRulesRaw)
    ? normalizeTextModelParameterRules(nextRulesRaw)
    : isImageModelParameterRules(nextRulesRaw)
      ? normalizeImageModelParameterRules(nextRulesRaw)
      : isVideoModelParameterRules(nextRulesRaw)
        ? normalizeVideoModelParameterRules(nextRulesRaw)
        : nextRulesRaw;

  await db
    .update(platformAiModels)
    .set({
      displayName: patch.displayName ?? existing.displayName,
      platformEnabled: patch.platformEnabled ?? existing.platformEnabled,
      providerModelId: patch.providerModelId ?? existing.providerModelId,
      parameterRules: nextRules,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      groupId:
        patch.groupId !== undefined ? patch.groupId : existing.groupId,
      description: patch.description ?? existing.description,
      updatedAt: new Date(),
    })
    .where(eq(platformAiModels.canonicalId, canonicalId));

  return getPlatformAiModel(db, canonicalId);
}

export async function listPlatformAiModelGroups(
  db: Database
): Promise<readonly PlatformAiModelGroup[]> {
  const rows = await db
    .select()
    .from(platformAiModelGroups)
    .orderBy(asc(platformAiModelGroups.sortOrder));

  return rows.map(mapPlatformGroupRow);
}

export async function getPlatformAiModelGroup(
  db: Database,
  id: string
): Promise<PlatformAiModelGroup | null> {
  const rows = await db
    .select()
    .from(platformAiModelGroups)
    .where(eq(platformAiModelGroups.id, id))
    .limit(1);
  const row = rows[0];
  return row ? mapPlatformGroupRow(row) : null;
}

export async function createPlatformAiModelGroup(
  db: Database,
  body: CreatePlatformAiModelGroupRequest
): Promise<PlatformAiModelGroup> {
  await db.insert(platformAiModelGroups).values({
    id: body.id,
    name: body.name,
    description: body.description ?? "",
    icon: body.icon ?? "sparkles",
    sortOrder: body.sortOrder ?? 0,
  });
  const created = await getPlatformAiModelGroup(db, body.id);
  if (!created) {
    throw new Error(`Failed to create platform AI model group ${body.id}`);
  }
  return created;
}

export async function updatePlatformAiModelGroup(
  db: Database,
  id: string,
  patch: UpdatePlatformAiModelGroupRequest
): Promise<PlatformAiModelGroup | null> {
  const existing = await getPlatformAiModelGroup(db, id);
  if (!existing) return null;

  await db
    .update(platformAiModelGroups)
    .set({
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      icon: patch.icon ?? existing.icon,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(platformAiModelGroups.id, id));

  return getPlatformAiModelGroup(db, id);
}

export async function deletePlatformAiModelGroup(
  db: Database,
  id: string
): Promise<boolean> {
  const existing = await getPlatformAiModelGroup(db, id);
  if (!existing) return false;

  await db
    .update(platformAiModels)
    .set({ groupId: null, updatedAt: new Date() })
    .where(eq(platformAiModels.groupId, id));

  await db
    .delete(platformAiModelGroups)
    .where(eq(platformAiModelGroups.id, id));

  return true;
}

export async function listModelInterfacePriorities(
  db: Database,
  organizationId: string
): Promise<readonly OrganizationModelInterfacePriority[]> {
  const rows = await db
    .select()
    .from(organizationModelInterfacePriorities)
    .where(eq(organizationModelInterfacePriorities.organizationId, organizationId));

  return rows.map((row) => ({
    canonicalId: row.canonicalId,
    interfaceIds: parseJsonColumn<string[]>(row.interfaceIds),
  }));
}

export async function upsertModelInterfacePriority(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceIds: readonly string[]
): Promise<OrganizationModelInterfacePriority> {
  await db
    .insert(organizationModelInterfacePriorities)
    .values({
      organizationId,
      canonicalId,
      interfaceIds: [...interfaceIds],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        organizationModelInterfacePriorities.organizationId,
        organizationModelInterfacePriorities.canonicalId,
      ],
      set: {
        interfaceIds: [...interfaceIds],
        updatedAt: new Date(),
      },
    });

  return { canonicalId, interfaceIds };
}

export async function createAiModelInvocation(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly userId?: string;
    readonly canonicalId: string;
    readonly displayName: string;
    readonly interfaceId?: string;
    readonly interfaceName?: string;
    readonly promptExcerpt: string;
    readonly content: string;
    readonly source: string;
    readonly status: AiModelInvocation["status"];
    readonly error?: string;
  }
): Promise<AiModelInvocation> {
  await db.insert(aiModelInvocations).values({
    id: params.id,
    organizationId: params.organizationId,
    userId: params.userId ?? null,
    canonicalId: params.canonicalId,
    displayName: params.displayName,
    interfaceId: params.interfaceId ?? null,
    interfaceName: params.interfaceName ?? null,
    promptExcerpt: params.promptExcerpt,
    content: params.content,
    source: params.source,
    status: params.status,
    error: params.error ?? null,
  });

  const rows = await db
    .select()
    .from(aiModelInvocations)
    .where(eq(aiModelInvocations.id, params.id))
    .limit(1);

  return mapInvocationRow(rows[0]!);
}

export async function listAiModelInvocations(
  db: Database,
  organizationId: string,
  options?: { readonly limit?: number; readonly offset?: number }
): Promise<ListAiModelInvocationsResponse> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const rows = await db
    .select()
    .from(aiModelInvocations)
    .where(eq(aiModelInvocations.organizationId, organizationId))
    .orderBy(desc(aiModelInvocations.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiModelInvocations)
    .where(eq(aiModelInvocations.organizationId, organizationId));

  return {
    invocations: rows.map(mapInvocationRow),
    total: countRows[0]?.count ?? 0,
  };
}

export async function listAdminAiModelInvocations(
  db: Database,
  options?: { readonly limit?: number; readonly offset?: number }
): Promise<ListAiModelInvocationsResponse> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const rows = await db
    .select()
    .from(aiModelInvocations)
    .orderBy(desc(aiModelInvocations.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiModelInvocations);

  return {
    invocations: rows.map(mapInvocationRow),
    total: countRows[0]?.count ?? 0,
  };
}

export async function getAiModelInvocation(
  db: Database,
  organizationId: string,
  id: string
): Promise<AiModelInvocation | null> {
  const rows = await db
    .select()
    .from(aiModelInvocations)
    .where(
      and(
        eq(aiModelInvocations.id, id),
        eq(aiModelInvocations.organizationId, organizationId)
      )
    )
    .limit(1);

  const row = rows[0];
  return row ? mapInvocationRow(row) : null;
}

export async function getAdminAiModelInvocation(
  db: Database,
  id: string
): Promise<AiModelInvocation | null> {
  const rows = await db
    .select()
    .from(aiModelInvocations)
    .where(eq(aiModelInvocations.id, id))
    .limit(1);

  const row = rows[0];
  return row ? mapInvocationRow(row) : null;
}

export function getTextParameterRules(
  model: PlatformAiModel
): TextModelParameterRules {
  if (isTextModelParameterRules(model.parameterRules)) {
    return normalizeTextModelParameterRules(model.parameterRules);
  }
  return DEFAULT_TEXT_MODEL_PARAMETER_RULES;
}

export function getImageParameterRules(
  model: PlatformAiModel
): ImageModelParameterRules {
  if (isImageModelParameterRules(model.parameterRules)) {
    return normalizeImageModelParameterRules(model.parameterRules);
  }
  return DEFAULT_IMAGE_MODEL_PARAMETER_RULES;
}

export function getVideoParameterRules(
  model: PlatformAiModel
): VideoModelParameterRules {
  if (isVideoModelParameterRules(model.parameterRules)) {
    return normalizeVideoModelParameterRules(model.parameterRules);
  }
  return DEFAULT_VIDEO_MODEL_PARAMETER_RULES;
}
