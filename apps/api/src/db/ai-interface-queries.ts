import type {
  AiInterfaceProvider,
  AiInterfaceSourceSpec,
  AiInterfaceTemplateIndex,
  OrganizationAiInterface,
  UpdateOrganizationAiInterfaceRequest,
} from "@dafthunk/types";
import { and, asc, desc, eq, ne } from "drizzle-orm";

import { parseInterfaceMetadata } from "../integrations/volcengine/metadata";
import type { Database } from "./index";
import {
  aiInterfaceTemplateRevisions,
  aiInterfaceTemplates,
  organizationAiInterfaces,
} from "./schema";

function rowToTemplateIndex(
  row: typeof aiInterfaceTemplates.$inferSelect
): AiInterfaceTemplateIndex {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    provider: row.provider as AiInterfaceProvider,
    executionMode: "sync",
    enabled: row.enabled,
    isSystem: row.isSystem,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    specVersion: row.specVersion,
    artifactChecksum: row.artifactChecksum,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

function rowToOrgInterface(
  row: typeof organizationAiInterfaces.$inferSelect
): OrganizationAiInterface {
  return {
    id: row.id,
    organizationId: row.organizationId,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    name: row.name,
    provider: row.provider as AiInterfaceProvider,
    baseUrl: row.baseUrl,
    selectedModel: row.selectedModel,
    enabled: row.enabled,
    isDefault: row.isDefault,
    hasApiKey: row.apiKeyEncrypted.length > 0,
    metadata: parseInterfaceMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAiInterfaceTemplateRows(db: Database) {
  return db
    .select()
    .from(aiInterfaceTemplates)
    .orderBy(asc(aiInterfaceTemplates.sortOrder), asc(aiInterfaceTemplates.name));
}

export async function getAiInterfaceTemplateRow(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(aiInterfaceTemplates)
    .where(eq(aiInterfaceTemplates.id, id))
    .limit(1);
  return row;
}

export async function listEnabledAiInterfaceTemplateRows(db: Database) {
  return db
    .select()
    .from(aiInterfaceTemplates)
    .where(eq(aiInterfaceTemplates.enabled, true))
    .orderBy(asc(aiInterfaceTemplates.sortOrder), asc(aiInterfaceTemplates.name));
}

export async function upsertAiInterfaceTemplateIndex(
  db: Database,
  params: {
    source: AiInterfaceSourceSpec;
    version: number;
    artifactChecksum: string;
    artifactKey: string;
    sourceKey: string;
    updatedBy?: string;
  }
): Promise<AiInterfaceTemplateIndex> {
  const now = new Date();
  const { source } = params;

  if (source.meta.isDefault) {
    await db
      .update(aiInterfaceTemplates)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(aiInterfaceTemplates.provider, source.meta.provider),
          eq(aiInterfaceTemplates.isDefault, true),
          ne(aiInterfaceTemplates.id, source.meta.id)
        )
      );
  }

  const values = {
    id: source.meta.id,
    name: source.meta.name,
    description: source.meta.description,
    provider: source.meta.provider,
    executionMode: source.execution.mode,
    enabled: source.meta.enabled,
    isSystem: source.meta.isSystem,
    isDefault: source.meta.isDefault ?? false,
    sortOrder: source.meta.sortOrder,
    specVersion: params.version,
    artifactChecksum: params.artifactChecksum,
    artifactKey: params.artifactKey,
    sourceKey: params.sourceKey,
    updatedAt: now,
    updatedBy: params.updatedBy ?? null,
  };

  const [row] = await db
    .insert(aiInterfaceTemplates)
    .values({ ...values, createdAt: now })
    .onConflictDoUpdate({
      target: aiInterfaceTemplates.id,
      set: values,
    })
    .returning();

  await db.insert(aiInterfaceTemplateRevisions).values({
    id: crypto.randomUUID(),
    templateId: source.meta.id,
    version: params.version,
    artifactChecksum: params.artifactChecksum,
    artifactKey: params.artifactKey,
    sourceKey: params.sourceKey,
    createdAt: now,
    createdBy: params.updatedBy ?? null,
  });

  return rowToTemplateIndex(row);
}

export async function deleteAiInterfaceTemplateRow(
  db: Database,
  id: string
): Promise<void> {
  await db.delete(aiInterfaceTemplates).where(eq(aiInterfaceTemplates.id, id));
}

export async function listOrganizationAiInterfaces(
  db: Database,
  organizationId: string
): Promise<OrganizationAiInterface[]> {
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.organizationId, organizationId))
    .orderBy(asc(organizationAiInterfaces.name));

  return rows.map(rowToOrgInterface);
}

export async function getOrganizationAiInterfaceRow(
  db: Database,
  organizationId: string,
  id: string
) {
  const [row] = await db
    .select()
    .from(organizationAiInterfaces)
    .where(
      and(
        eq(organizationAiInterfaces.organizationId, organizationId),
        eq(organizationAiInterfaces.id, id)
      )
    )
    .limit(1);
  return row;
}

export async function getOrganizationAiInterfaceDefaultRow(
  db: Database,
  organizationId: string,
  provider: AiInterfaceProvider
) {
  const [row] = await db
    .select()
    .from(organizationAiInterfaces)
    .where(
      and(
        eq(organizationAiInterfaces.organizationId, organizationId),
        eq(organizationAiInterfaces.provider, provider),
        eq(organizationAiInterfaces.enabled, true),
        eq(organizationAiInterfaces.isDefault, true)
      )
    )
    .limit(1);
  return row;
}

async function clearOrgDefault(
  db: Database,
  organizationId: string,
  provider: AiInterfaceProvider,
  exceptId?: string
) {
  const conditions = [
    eq(organizationAiInterfaces.organizationId, organizationId),
    eq(organizationAiInterfaces.provider, provider),
    eq(organizationAiInterfaces.isDefault, true),
  ];
  if (exceptId) {
    conditions.push(ne(organizationAiInterfaces.id, exceptId));
  }

  await db
    .update(organizationAiInterfaces)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(...conditions));
}

export async function createOrganizationAiInterface(
  db: Database,
  organizationId: string,
  input: {
    id: string;
    templateId: string;
    name: string;
    provider: AiInterfaceProvider;
    templateVersion?: number | null;
    baseUrl?: string | null;
    selectedModel?: string | null;
    apiKeyEncrypted: string;
    metadata?: string | null;
    enabled?: boolean;
    isDefault?: boolean;
  }
): Promise<OrganizationAiInterface> {
  const now = new Date();
  if (input.isDefault) {
    await clearOrgDefault(db, organizationId, input.provider);
  }

  const [row] = await db
    .insert(organizationAiInterfaces)
    .values({
      id: input.id,
      organizationId,
      templateId: input.templateId,
      templateVersion: input.templateVersion ?? null,
      name: input.name,
      provider: input.provider,
      baseUrl: input.baseUrl ?? null,
      selectedModel: input.selectedModel ?? null,
      apiKeyEncrypted: input.apiKeyEncrypted,
      metadata: input.metadata ?? null,
      enabled: input.enabled ?? true,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return rowToOrgInterface(row);
}

export async function updateOrganizationAiInterface(
  db: Database,
  organizationId: string,
  id: string,
  input: UpdateOrganizationAiInterfaceRequest & {
    apiKeyEncrypted?: string;
    metadata?: string;
  }
): Promise<OrganizationAiInterface> {
  const existing = await getOrganizationAiInterfaceRow(db, organizationId, id);
  if (!existing) {
    throw new Error("AI interface not found");
  }

  if (input.isDefault) {
    await clearOrgDefault(
      db,
      organizationId,
      existing.provider as AiInterfaceProvider,
      id
    );
  }

  const [row] = await db
    .update(organizationAiInterfaces)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.templateVersion !== undefined
        ? { templateVersion: input.templateVersion }
        : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.selectedModel !== undefined
        ? { selectedModel: input.selectedModel }
        : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.apiKeyEncrypted !== undefined
        ? { apiKeyEncrypted: input.apiKeyEncrypted }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationAiInterfaces.organizationId, organizationId),
        eq(organizationAiInterfaces.id, id)
      )
    )
    .returning();

  return rowToOrgInterface(row);
}

export async function deleteOrganizationAiInterface(
  db: Database,
  organizationId: string,
  id: string
): Promise<void> {
  await db
    .delete(organizationAiInterfaces)
    .where(
      and(
        eq(organizationAiInterfaces.organizationId, organizationId),
        eq(organizationAiInterfaces.id, id)
      )
    );
}

export async function resolveOrganizationAiInterfaceRow(
  db: Database,
  organizationId: string,
  params: { interfaceId?: string; templateId?: string }
) {
  if (params.interfaceId) {
    return getOrganizationAiInterfaceRow(
      db,
      organizationId,
      params.interfaceId
    );
  }

  if (params.templateId) {
    const [byTemplate] = await db
      .select()
      .from(organizationAiInterfaces)
      .where(
        and(
          eq(organizationAiInterfaces.organizationId, organizationId),
          eq(organizationAiInterfaces.templateId, params.templateId),
          eq(organizationAiInterfaces.enabled, true)
        )
      )
      .orderBy(desc(organizationAiInterfaces.isDefault))
      .limit(1);

    if (byTemplate) {
      return byTemplate;
    }

    const template = await getAiInterfaceTemplateRow(db, params.templateId);
    if (template) {
      return getOrganizationAiInterfaceDefaultRow(
        db,
        organizationId,
        template.provider as AiInterfaceProvider
      );
    }
  }

  return undefined;
}

export { rowToTemplateIndex };
