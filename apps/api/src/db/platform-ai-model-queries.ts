import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

import type {
  AiModelInvocation,
  AiModelModality,
  ListAiModelInvocationsResponse,
  PlatformAiModel,
  PlatformAiModelParameterRules,
  TextModelParameterRules,
  UpdatePlatformAiModelRequest,
} from "@dafthunk/types";
import {
  DEFAULT_AUDIO_MODEL_PARAMETER_RULES,
  DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
  DEFAULT_TEXT_MODEL_PARAMETER_RULES,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  isAudioModelParameterRules,
  isImageModelParameterRules,
  isTextModelParameterRules,
  isVideoModelParameterRules,
  normalizeAudioModelParameterRules,
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
  type AudioModelParameterRules,
  type ImageModelParameterRules,
  type VideoModelParameterRules,
} from "@dafthunk/types";

import type { Database } from "./index";
import { parseJsonColumn } from "./parse-json-column";
import {
  aiModelInvocations,
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
    parameterRules: parseJsonColumn<PlatformAiModelParameterRules>(
      row.parameterRules
    ),
    sortOrder: row.sortOrder,
    brandIcon: row.brandIcon ?? null,
    description: row.description ?? "",
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
    generationJobId: row.generationJobId,
    workflowId: row.workflowId,
    nodeId: row.nodeId,
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

function normalizeParameterRulesForModality(
  modality: AiModelModality,
  rules: PlatformAiModelParameterRules
): PlatformAiModelParameterRules {
  switch (modality) {
    case "text":
      return isTextModelParameterRules(rules)
        ? normalizeTextModelParameterRules(rules)
        : DEFAULT_TEXT_MODEL_PARAMETER_RULES;
    case "image":
      return isImageModelParameterRules(rules)
        ? normalizeImageModelParameterRules(rules)
        : DEFAULT_IMAGE_MODEL_PARAMETER_RULES;
    case "video":
      return normalizeVideoModelParameterRules(
        isVideoModelParameterRules(rules)
          ? rules
          : {
              ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
              ...rules,
            }
      );
    case "audio":
      return isAudioModelParameterRules(rules)
        ? normalizeAudioModelParameterRules(rules)
        : DEFAULT_AUDIO_MODEL_PARAMETER_RULES;
    default:
      return rules;
  }
}

export async function updatePlatformAiModel(
  db: Database,
  canonicalId: string,
  patch: UpdatePlatformAiModelRequest
): Promise<PlatformAiModel | null> {
  const existing = await getPlatformAiModel(db, canonicalId);
  if (!existing) return null;

  const nextRulesRaw = patch.parameterRules ?? existing.parameterRules;
  const nextRules = normalizeParameterRulesForModality(
    existing.modality,
    nextRulesRaw
  );

  await db
    .update(platformAiModels)
    .set({
      displayName: patch.displayName ?? existing.displayName,
      platformEnabled: patch.platformEnabled ?? existing.platformEnabled,
      parameterRules: nextRules,
      brandIcon:
        patch.brandIcon !== undefined ? patch.brandIcon : existing.brandIcon,
      description: patch.description ?? existing.description,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(platformAiModels.canonicalId, canonicalId));

  return getPlatformAiModel(db, canonicalId);
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
    readonly generationJobId?: string;
    readonly workflowId?: string;
    readonly nodeId?: string;
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
    generationJobId: params.generationJobId ?? null,
    workflowId: params.workflowId ?? null,
    nodeId: params.nodeId ?? null,
  });

  const rows = await db
    .select()
    .from(aiModelInvocations)
    .where(eq(aiModelInvocations.id, params.id))
    .limit(1);

  return mapInvocationRow(rows[0]!);
}

export async function getAiModelInvocationByGenerationJobId(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly generationJobId: string;
  }
): Promise<AiModelInvocation | null> {
  const [row] = await db
    .select()
    .from(aiModelInvocations)
    .where(
      and(
        eq(aiModelInvocations.organizationId, params.organizationId),
        eq(aiModelInvocations.generationJobId, params.generationJobId)
      )
    )
    .limit(1);

  return row ? mapInvocationRow(row) : null;
}

export async function completeAiModelInvocationForGenerationJob(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly generationJobId: string;
    readonly content: string;
  }
): Promise<void> {
  await db
    .update(aiModelInvocations)
    .set({
      status: "completed",
      content: params.content,
      error: null,
    })
    .where(
      and(
        eq(aiModelInvocations.organizationId, params.organizationId),
        eq(aiModelInvocations.generationJobId, params.generationJobId),
        eq(aiModelInvocations.status, "pending")
      )
    );
}

export async function failAiModelInvocationForGenerationJob(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly generationJobId: string;
    readonly error: string;
  }
): Promise<void> {
  await db
    .update(aiModelInvocations)
    .set({
      status: "failed",
      error: params.error,
    })
    .where(
      and(
        eq(aiModelInvocations.organizationId, params.organizationId),
        eq(aiModelInvocations.generationJobId, params.generationJobId),
        ne(aiModelInvocations.status, "completed")
      )
    );
}

export async function cancelAiModelInvocationForGenerationJob(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly generationJobId: string;
    readonly content?: string;
  }
): Promise<void> {
  await db
    .update(aiModelInvocations)
    .set({
      status: "cancelled",
      error: null,
      ...(params.content !== undefined ? { content: params.content } : {}),
    })
    .where(
      and(
        eq(aiModelInvocations.organizationId, params.organizationId),
        eq(aiModelInvocations.generationJobId, params.generationJobId),
        ne(aiModelInvocations.status, "completed")
      )
    );
}

export async function finalizeAiModelInvocation(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: AiModelInvocation["status"];
    readonly content?: string;
    readonly error?: string | null;
    readonly interfaceId?: string | null;
    readonly interfaceName?: string | null;
    readonly generationJobId?: string | null;
  }
): Promise<void> {
  await db
    .update(aiModelInvocations)
    .set({
      status: params.status,
      ...(params.content !== undefined ? { content: params.content } : {}),
      ...(params.error !== undefined ? { error: params.error } : {}),
      ...(params.interfaceId !== undefined
        ? { interfaceId: params.interfaceId }
        : {}),
      ...(params.interfaceName !== undefined
        ? { interfaceName: params.interfaceName }
        : {}),
      ...(params.generationJobId !== undefined
        ? { generationJobId: params.generationJobId }
        : {}),
    })
    .where(
      and(
        eq(aiModelInvocations.id, params.id),
        eq(aiModelInvocations.organizationId, params.organizationId)
      )
    );
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

export function getAudioParameterRules(
  model: PlatformAiModel
): AudioModelParameterRules {
  if (isAudioModelParameterRules(model.parameterRules)) {
    return normalizeAudioModelParameterRules(model.parameterRules);
  }
  return DEFAULT_AUDIO_MODEL_PARAMETER_RULES;
}
