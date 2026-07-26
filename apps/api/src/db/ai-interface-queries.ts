import type {
  AiInterfaceProvider,
  OrganizationAiInterface,
  UpdateOrganizationAiInterfaceRequest,
} from "@dafthunk/types";
import { and, desc, eq, ne } from "drizzle-orm";

import { parseInterfaceMetadata } from "../integrations/volcengine/metadata";
import { readApiKeyHint } from "../utils/api-key-hint";
import type { Database } from "./index";
import { organizationAiInterfaces } from "./schema";

function rowToOrgInterface(
  row: typeof organizationAiInterfaces.$inferSelect
): OrganizationAiInterface {
  const metadata = parseInterfaceMetadata(row.metadata);
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
    apiKeyHint: readApiKeyHint(metadata),
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listOrganizationAiInterfaces(
  db: Database,
  organizationId: string
): Promise<OrganizationAiInterface[]> {
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.organizationId, organizationId))
    .orderBy(desc(organizationAiInterfaces.createdAt));

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
        eq(organizationAiInterfaces.enabled, true)
      )
    )
    .orderBy(desc(organizationAiInterfaces.isDefault))
    .limit(1);
  return row;
}

async function clearOrgDefault(
  db: Database,
  organizationId: string,
  provider: AiInterfaceProvider,
  exceptId?: string
): Promise<void> {
  const conditions = [
    eq(organizationAiInterfaces.organizationId, organizationId),
    eq(organizationAiInterfaces.provider, provider),
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
    name: string;
    provider: AiInterfaceProvider;
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
      templateId: null,
      templateVersion: null,
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

    // Legacy canvas nodes keyed by template id → fall back to provider default.
    const providerByLegacyTemplate: Record<string, AiInterfaceProvider> = {
      "doubao-volcano-chat-v1": "doubao_volcano",
      "builtin:doubao_volcano": "doubao_volcano",
      "openai-chat-v1": "openai",
      "builtin:openai": "openai",
      "deepseek-chat-v1": "deepseek",
      "builtin:deepseek": "deepseek",
    };
    const provider = providerByLegacyTemplate[params.templateId];
    if (provider) {
      return getOrganizationAiInterfaceDefaultRow(
        db,
        organizationId,
        provider
      );
    }
  }

  return undefined;
}
