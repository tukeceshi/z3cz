import type {
  CreateFormatTransformTemplateRequest,
  FormatTransformScope,
  FormatTransformTemplate,
  ForwardingLockedResolution,
  TransformParamMapping,
  TransformUpstreamParam,
  UpdateFormatTransformTemplateRequest,
} from "@dafthunk/types";
import { FORWARDING_LOCKED_RESOLUTIONS } from "@dafthunk/types";
import { asc, eq } from "drizzle-orm";

import type { Database } from "./index";
import { formatTransformTemplates } from "./schema";

function parseUpstreamParams(value: unknown): TransformUpstreamParam[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is TransformUpstreamParam =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as TransformUpstreamParam).id === "string" &&
      typeof (entry as TransformUpstreamParam).name === "string" &&
      typeof (entry as TransformUpstreamParam).valueType === "string"
  );
}

function parseParamMappings(value: unknown): TransformParamMapping[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is TransformParamMapping => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }

    const mapping = entry as TransformParamMapping;
    if (typeof mapping.upstreamParamId !== "string") {
      return false;
    }

    if (mapping.transform === "ratio_resolution_to_size") {
      return true;
    }

    return typeof mapping.sourcePath === "string";
  });
}

function parseLockedResolution(
  value: string | null | undefined
): ForwardingLockedResolution | null {
  if (!value) {
    return null;
  }

  return FORWARDING_LOCKED_RESOLUTIONS.includes(
    value as ForwardingLockedResolution
  )
    ? (value as ForwardingLockedResolution)
    : null;
}

function parseScope(value: string | null | undefined): FormatTransformScope {
  return value === "platform" ? "platform" : "platform";
}

function rowToTemplate(
  row: typeof formatTransformTemplates.$inferSelect
): FormatTransformTemplate {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as FormatTransformTemplate["provider"],
    scope: parseScope(row.scope),
    upstreamParams: parseUpstreamParams(row.upstreamParams),
    paramMappings: parseParamMappings(row.paramMappings),
    lockedResolution: parseLockedResolution(row.lockedResolution),
    supportsTaskCancel: row.supportsTaskCancel,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function listFormatTransformTemplates(
  db: Database
): Promise<FormatTransformTemplate[]> {
  const rows = await db
    .select()
    .from(formatTransformTemplates)
    .orderBy(asc(formatTransformTemplates.name));

  return rows.map(rowToTemplate);
}

export async function listEnabledPlatformFormatTransformTemplates(
  db: Database
): Promise<FormatTransformTemplate[]> {
  const rows = await db
    .select()
    .from(formatTransformTemplates)
    .where(eq(formatTransformTemplates.enabled, true))
    .orderBy(asc(formatTransformTemplates.name));

  return rows
    .map(rowToTemplate)
    .filter((template) => template.scope === "platform");
}

export async function getFormatTransformTemplateById(
  db: Database,
  id: string
): Promise<FormatTransformTemplate | null> {
  const rows = await db
    .select()
    .from(formatTransformTemplates)
    .where(eq(formatTransformTemplates.id, id))
    .limit(1);

  const row = rows[0];
  return row ? rowToTemplate(row) : null;
}

export async function createFormatTransformTemplate(
  db: Database,
  params: {
    readonly id: string;
    readonly input: CreateFormatTransformTemplateRequest;
    readonly updatedBy?: string | null;
  }
): Promise<FormatTransformTemplate> {
  const rows = await db
    .insert(formatTransformTemplates)
    .values({
      id: params.id,
      name: params.input.name,
      provider: params.input.provider,
      scope: "platform",
      upstreamParams: params.input.upstreamParams ?? [],
      paramMappings: params.input.paramMappings ?? [],
      lockedResolution: params.input.lockedResolution ?? null,
      supportsTaskCancel: params.input.supportsTaskCancel ?? false,
      enabled: params.input.enabled ?? true,
      updatedBy: params.updatedBy ?? null,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create format transform template");
  }

  return rowToTemplate(row);
}

export async function updateFormatTransformTemplate(
  db: Database,
  params: {
    readonly id: string;
    readonly input: UpdateFormatTransformTemplateRequest;
    readonly updatedBy?: string | null;
  }
): Promise<FormatTransformTemplate | null> {
  const patch: Partial<typeof formatTransformTemplates.$inferInsert> = {
    updatedBy: params.updatedBy ?? null,
  };

  if (params.input.name !== undefined) {
    patch.name = params.input.name;
  }
  if (params.input.provider !== undefined) {
    patch.provider = params.input.provider;
  }
  if (params.input.upstreamParams !== undefined) {
    patch.upstreamParams = params.input.upstreamParams;
  }
  if (params.input.paramMappings !== undefined) {
    patch.paramMappings = params.input.paramMappings;
  }
  if (params.input.lockedResolution !== undefined) {
    patch.lockedResolution = params.input.lockedResolution;
  }
  if (params.input.supportsTaskCancel !== undefined) {
    patch.supportsTaskCancel = params.input.supportsTaskCancel;
  }
  if (params.input.enabled !== undefined) {
    patch.enabled = params.input.enabled;
  }

  const rows = await db
    .update(formatTransformTemplates)
    .set(patch)
    .where(eq(formatTransformTemplates.id, params.id))
    .returning();

  const row = rows[0];
  return row ? rowToTemplate(row) : null;
}

export async function deleteFormatTransformTemplate(
  db: Database,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(formatTransformTemplates)
    .where(eq(formatTransformTemplates.id, id))
    .returning({ id: formatTransformTemplates.id });

  return rows.length > 0;
}
