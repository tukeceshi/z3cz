import type { CharacterLibraryEntry } from "@dafthunk/types";
import { and, desc, eq } from "drizzle-orm";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { aiModelInvocations, organizationAiInterfaces } from "../db/schema";
import {
  getCharacterLibraryEntry,
  setCharacterLibraryAssetImport,
} from "../db/character-library-queries";
import {
  createAiModelInvocation,
  finalizeAiModelInvocation,
} from "../db/platform-ai-model-queries";
import { resolveMediaResources } from "./media-resource-catalog-service";
import { createUpstreamRequestLogger } from "./create-upstream-request-logger";
import { decryptSecret } from "../utils/encryption";
import { getVolcanoCredentials } from "../integrations/volcengine/ensure-api-key";
import {
  createStandaloneAsset,
  createStandaloneAssetGroup,
  getStandaloneAssetStatus,
  createVolcanoAsset,
  createVolcanoAssetGroup,
  getVolcanoAssetStatus,
  type StandaloneAssetContext,
  type VolcanoAssetRequestLogSink,
  type VolcanoAssetStatus,
} from "../integrations/volcengine/asset-library";
import type { VolcengineCredentials } from "../integrations/volcengine/client";
import { isSingleModelProviderMetadata } from "@dafthunk/types";
import type { VolcanoInterfaceMetadata } from "@dafthunk/types";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";

const INVOCATION_SOURCE = "character-library-import";
const INVOCATION_CANONICAL_ID = "volcano-asset-library";
const INVOCATION_DISPLAY_NAME = "素材资产库";

interface ResolvedAssetContext {
  readonly mode: "standalone" | "aggregate";
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly metadataRaw: string;
  readonly standalone?: StandaloneAssetContext;
  readonly credentials?: VolcengineCredentials;
}

async function resolveAssetContext(
  env: Bindings,
  db: Database,
  organizationId: string,
  preferredInterfaceId: string | null
): Promise<ResolvedAssetContext | null> {
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.organizationId, organizationId))
    .orderBy(desc(organizationAiInterfaces.createdAt));

  const candidates: typeof rows = [];
  const preferred = preferredInterfaceId
    ? rows.find((row) => row.id === preferredInterfaceId)
    : undefined;
  if (preferred) {
    candidates.push(preferred);
  }
  for (const row of rows) {
    if (row.id !== preferred?.id) {
      candidates.push(row);
    }
  }

  for (const row of candidates) {
    if (!row.enabled) continue;
    const metadata = parseInterfaceMetadata(row.metadata);
    if (isVolcanoMetadata(metadata)) {
      const credentials = await getVolcanoCredentials(
        env,
        organizationId,
        row.metadata
      );
      if (credentials) {
        return {
          mode: "aggregate",
          interfaceId: row.id,
          interfaceName: row.name,
          metadataRaw: row.metadata ?? "{}",
          credentials,
        };
      }
      continue;
    }
    if (isSingleModelProviderMetadata(metadata)) {
      const apiKey = await decryptSecret(
        row.apiKeyEncrypted,
        env,
        organizationId
      );
      if (!apiKey) continue;
      let gatewayOrigin: string | null = null;
      if (row.baseUrl) {
        try {
          gatewayOrigin = new URL(row.baseUrl).origin;
        } catch {
          gatewayOrigin = null;
        }
      }
      if (!gatewayOrigin) continue;
      return {
        mode: "standalone",
        interfaceId: row.id,
        interfaceName: row.name,
        metadataRaw: row.metadata ?? "{}",
        standalone: { gatewayOrigin, apiKey },
      };
    }
  }
  return null;
}

async function persistMetadata(
  db: Database,
  context: ResolvedAssetContext,
  patch: Record<string, unknown>
): Promise<void> {
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(context.metadataRaw) as Record<string, unknown>;
  } catch {
    current = {};
  }
  const merged = { ...current, ...patch };
  await db
    .update(organizationAiInterfaces)
    .set({ metadata: JSON.stringify(merged) })
    .where(eq(organizationAiInterfaces.id, context.interfaceId));
}

async function ensureAssetGroupId(
  db: Database,
  env: Bindings,
  organizationId: string,
  context: ResolvedAssetContext,
  requestLogSink: VolcanoAssetRequestLogSink
): Promise<string> {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(context.metadataRaw) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  const existing = metadata["characterLibraryAssetGroupId"];
  if (typeof existing === "string" && existing) {
    return existing;
  }

  const groupId =
    context.mode === "standalone"
      ? await createStandaloneAssetGroup({
          context: context.standalone!,
          name: `z3cz-character-library-${organizationId}`,
          requestLogSink,
        })
      : await createVolcanoAssetGroup({
          credentials: context.credentials!,
          name: `z3cz-character-library-${organizationId}`,
          requestLogSink,
        });

  await persistMetadata(db, context, { characterLibraryAssetGroupId: groupId });
  return groupId;
}

async function createInvocation(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly resourceId: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await createAiModelInvocation(params.db, {
    id,
    organizationId: params.organizationId,
    canonicalId: INVOCATION_CANONICAL_ID,
    displayName: INVOCATION_DISPLAY_NAME,
    interfaceId: params.interfaceId,
    interfaceName: params.interfaceName,
    promptExcerpt: `resource:${params.resourceId}`,
    content: "",
    source: INVOCATION_SOURCE,
    status: "pending",
  });
  return id;
}

async function findInvocationIdByResource(
  db: Database,
  organizationId: string,
  resourceId: string
): Promise<string | null> {
  const [invocation] = await db
    .select({ id: aiModelInvocations.id })
    .from(aiModelInvocations)
    .where(
      and(
        eq(aiModelInvocations.organizationId, organizationId),
        eq(aiModelInvocations.source, INVOCATION_SOURCE),
        eq(aiModelInvocations.promptExcerpt, `resource:${resourceId}`)
      )
    )
    .orderBy(desc(aiModelInvocations.createdAt))
    .limit(1);
  return invocation?.id ?? null;
}

async function finalizeInvocationByResource(
  db: Database,
  organizationId: string,
  resourceId: string,
  update: {
    readonly status: "completed" | "failed";
    readonly content?: string;
    readonly error?: string;
  }
): Promise<void> {
  const invocationId = await findInvocationIdByResource(
    db,
    organizationId,
    resourceId
  );
  if (!invocationId) return;
  await finalizeAiModelInvocation(db, {
    id: invocationId,
    organizationId,
    status: update.status,
    ...(update.content !== undefined ? { content: update.content } : {}),
    error: update.error ?? null,
  });
}

/**
 * Submit a character library resource to the Volcano private asset library.
 * URL acquisition reuses the video-generation resource resolution channel.
 */
export async function importCharacterResourceToVolcano(
  env: Bindings,
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<CharacterLibraryEntry> {
  const entry = await getCharacterLibraryEntry(db, {
    organizationId: params.organizationId,
    resourceId: params.resourceId,
  });
  if (!entry) {
    throw new Error("Character library entry not found");
  }

  const context = await resolveAssetContext(
    env,
    db,
    params.organizationId,
    entry.interfaceId
  );
  if (!context) {
    throw new Error(
      "未找到可用的 AI 接口凭据（独立 API Key 或火山 AK/SK），无法入库"
    );
  }

  const invocationId = await createInvocation({
    db,
    organizationId: params.organizationId,
    resourceId: params.resourceId,
    interfaceId: context.interfaceId,
    interfaceName: context.interfaceName,
  });
  const requestLogSink = createUpstreamRequestLogger(db, {
    organizationId: params.organizationId,
    interfaceId: context.interfaceId,
    invocationId,
    operation: "submit",
  }) as unknown as VolcanoAssetRequestLogSink;

  try {
    const resolved = await resolveMediaResources(env, {
      organizationId: params.organizationId,
      resourceIds: [params.resourceId],
    });
    const url = resolved.resolved.find(
      (item) => item.resourceId === params.resourceId && item.url
    )?.url;
    if (!url) {
      throw new Error("资源没有可用的访问 URL，无法提交入库");
    }

    const groupId = await ensureAssetGroupId(
      db,
      env,
      params.organizationId,
      context,
      requestLogSink
    );
    const assetId =
      context.mode === "standalone"
        ? await createStandaloneAsset({
            context: context.standalone!,
            groupId,
            url,
            name: params.resourceId,
            requestLogSink,
          })
        : await createVolcanoAsset({
            credentials: context.credentials!,
            groupId,
            url,
            name: params.resourceId,
            requestLogSink,
          });

    await setCharacterLibraryAssetImport(db, {
      organizationId: params.organizationId,
      resourceId: params.resourceId,
      assetId,
      status: "pending",
    });
    // Submit succeeded but upstream processing is async — the invocation
    // stays "pending" until polling observes active/failed.
    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId: params.organizationId,
      status: "pending",
      content: `asset:${assetId} submitted`,
      error: null,
    });

    return {
      ...entry,
      upstreamAssetId: assetId,
      upstreamAssetStatus: "pending",
    };
  } catch (error) {
    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId: params.organizationId,
      status: "failed",
      error: error instanceof Error ? error.message : "Import failed",
    });
    throw error;
  }
}

/** Poll the upstream import status and persist it locally. */
export async function refreshCharacterResourceImportStatus(
  env: Bindings,
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<{ status: VolcanoAssetStatus; assetId: string | null }> {
  const entry = await getCharacterLibraryEntry(db, {
    organizationId: params.organizationId,
    resourceId: params.resourceId,
  });
  if (!entry?.upstreamAssetId) {
    throw new Error("Character library entry has no upstream asset");
  }

  const context = await resolveAssetContext(
    env,
    db,
    params.organizationId,
    entry.interfaceId
  );
  if (!context) {
    throw new Error(
      "未找到可用的 AI 接口凭据（独立 API Key 或火山 AK/SK）"
    );
  }

  const invocationId = await findInvocationIdByResource(
    db,
    params.organizationId,
    params.resourceId
  );
  const requestLogSink = createUpstreamRequestLogger(db, {
    organizationId: params.organizationId,
    interfaceId: context.interfaceId,
    invocationId,
    operation: "poll",
  }) as unknown as VolcanoAssetRequestLogSink;

  const assetId = entry.upstreamAssetId.replace(/^asset:\/\//, "");
  const state =
    context.mode === "standalone"
      ? await getStandaloneAssetStatus({
          context: context.standalone!,
          assetId,
          requestLogSink,
        })
      : await getVolcanoAssetStatus({
          credentials: context.credentials!,
          assetId,
          requestLogSink,
        });

  await setCharacterLibraryAssetImport(db, {
    organizationId: params.organizationId,
    resourceId: params.resourceId,
    assetId: state.assetId,
    status: state.status,
  });
  if (state.status !== "pending") {
    await finalizeInvocationByResource(
      db,
      params.organizationId,
      params.resourceId,
      {
        status: state.status === "failed" ? "failed" : "completed",
        content: `asset:${state.assetId} ${state.status}`,
        error:
          state.status === "failed" ? "upstream asset import failed" : undefined,
      }
    );
  }

  return { status: state.status, assetId: state.assetId };
}
