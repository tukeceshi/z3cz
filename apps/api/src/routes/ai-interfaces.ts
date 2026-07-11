import type {
  AiInterfaceProvider,
  CreateOrganizationAiInterfaceRequest,
  ListAiInterfaceTemplatesResponse,
  ListOrganizationAiInterfacesResponse,
  OrganizationAiInterface,
  UpdateOrganizationAiInterfaceRequest,
  VolcanoProbeActivationResponse,
  VolcanoProbeCredentialsRequest,
  VolcanoSnapshotResponse,
} from "@dafthunk/types";
import {
  ALL_AI_INTERFACE_PROVIDERS,
  VOLCANO_AI_MODEL_CATALOG,
  VOLCANO_TEMPLATE_ID,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import { createDatabase } from "../db";
import {
  createOrganizationAiInterface,
  deleteOrganizationAiInterface,
  getAiInterfaceTemplateRow,
  getOrganizationAiInterfaceRow,
  listOrganizationAiInterfaces,
  updateOrganizationAiInterface,
} from "../db/ai-interface-queries";
import { AiInterfaceTemplateStore } from "../stores/ai-interface-template-store";
import { encryptSecret } from "../utils/encryption";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { getVolcanoArkApiKey } from "../integrations/volcengine/get-api-key";
import { ensureVolcanoApiKey } from "../integrations/volcengine/ensure-api-key";
import {
  createVolcanoMetadata,
  isVolcanoMetadata,
  mergeVolcanoModelEnabled,
  mergeVolcanoActivationCache,
  parseInterfaceMetadata,
  resolveVolcanoCatalogEntries,
  serializeInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { probeVolcanoModelsActivation } from "../integrations/volcengine/probe-model-activation";
import { buildVolcanoSnapshot } from "../integrations/volcengine/snapshot";
import { VOLCANO_ARK_INFERENCE_BASE_URL } from "../integrations/volcengine/constants";
const aiInterfaceRoutes = new Hono<ApiContext>();

aiInterfaceRoutes.use("*", jwtMiddleware);
aiInterfaceRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

const providerSchema = z.enum(
  ALL_AI_INTERFACE_PROVIDERS as unknown as [
    (typeof ALL_AI_INTERFACE_PROVIDERS)[number],
    ...(typeof ALL_AI_INTERFACE_PROVIDERS)[number][],
  ]
);

const createSchema = z
  .object({
    templateId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    apiKey: z.string().trim().min(1).optional(),
    accessKeyId: z.string().trim().min(1).optional(),
    secretAccessKey: z.string().trim().min(1).optional(),
    enabledModels: z.array(z.string()).optional(),
    templateVersion: z.number().int().positive().nullable().optional(),
    baseUrl: z.string().url().nullable().optional(),
    selectedModel: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const isVolcano = value.templateId === VOLCANO_TEMPLATE_ID;
    if (isVolcano) {
      if (!value.accessKeyId || !value.secretAccessKey) {
        ctx.addIssue({
          code: "custom",
          message: "Access Key ID and Secret are required for Volcano",
          path: ["accessKeyId"],
        });
      }
      return;
    }
    if (!value.apiKey) {
      ctx.addIssue({
        code: "custom",
        message: "API key is required",
        path: ["apiKey"],
      });
    }
  }) satisfies z.ZodType<CreateOrganizationAiInterfaceRequest>;

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  apiKey: z.string().trim().min(1).optional(),
  templateVersion: z.number().int().positive().nullable().optional(),
  baseUrl: z.string().url().nullable().optional(),
  selectedModel: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  volcanoModelEnabled: z.record(z.string(), z.boolean()).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}) satisfies z.ZodType<UpdateOrganizationAiInterfaceRequest>;

const probeCredentialsSchema = z.object({
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  canonicalIds: z.array(z.string()).optional(),
}) satisfies z.ZodType<VolcanoProbeCredentialsRequest>;

const probeActivationSchema = z.object({
  canonicalIds: z.array(z.string()).optional(),
});
aiInterfaceRoutes.get("/catalog", async (c) => {
  try {
    const store = new AiInterfaceTemplateStore(c.env);
    const templates = (await store.listTemplates()).filter(
      (template) => template.enabled
    );
    return c.json({ templates } satisfies ListAiInterfaceTemplatesResponse);
  } catch (error) {
    console.error("Error listing AI interface catalog:", error);
    return c.json({ error: "Failed to list templates" }, 500);
  }
});

aiInterfaceRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);

  try {
    const interfaces = await listOrganizationAiInterfaces(db, organizationId);
    return c.json({ interfaces } satisfies ListOrganizationAiInterfacesResponse);
  } catch (error) {
    console.error("Error listing organization AI interfaces:", error);
    return c.json({ error: "Failed to list AI interfaces" }, 500);
  }
});

aiInterfaceRoutes.get("/:id/volcano-snapshot", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");

  try {
    const snapshot = await buildVolcanoSnapshot({
      env: c.env,
      organizationId,
      interfaceId: id,
    });
    return c.json({ snapshot } satisfies { snapshot: VolcanoSnapshotResponse });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch volcano snapshot";
    console.error("Error fetching volcano snapshot:", error);
    const status = message === "AI interface not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

aiInterfaceRoutes.post(
  "/volcano-probe-credentials",
  zValidator("json", probeCredentialsSchema),
  async (c) => {
    const body = c.req.valid("json");

    try {
      const issued = await getVolcanoArkApiKey({
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
        region: "cn-beijing",
      });
      const entries = resolveVolcanoCatalogEntries(body.canonicalIds);
      const results = await probeVolcanoModelsActivation({
        apiKey: issued.apiKey,
        entries,
      });
      return c.json({ results } satisfies VolcanoProbeActivationResponse);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to probe model activation";
      console.error("Error probing volcano credentials:", error);
      return c.json({ error: message }, 400);
    }
  }
);

aiInterfaceRoutes.post(
  "/:id/probe-activation",
  zValidator("json", probeActivationSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const row = await getOrganizationAiInterfaceRow(db, organizationId, id);
      if (!row) {
        return c.json({ error: "AI interface not found" }, 404);
      }

      const metadata = parseInterfaceMetadata(row.metadata);
      if (!isVolcanoMetadata(metadata)) {
        return c.json({ error: "Volcano metadata not configured" }, 400);
      }

      const ensured = await ensureVolcanoApiKey({
        env: c.env,
        organizationId,
        metadataRaw: row.metadata,
        apiKeyEncrypted: row.apiKeyEncrypted,
      });

      if (ensured.renewed) {
        await updateOrganizationAiInterface(db, organizationId, row.id, {
          metadata: ensured.metadataRaw,
          apiKeyEncrypted: ensured.apiKeyEncrypted,
        });
      }

      const entries = resolveVolcanoCatalogEntries(body.canonicalIds);
      const results = await probeVolcanoModelsActivation({
        apiKey: ensured.apiKey,
        entries,
      });

      const nextMetadata = mergeVolcanoActivationCache(metadata, results);
      await updateOrganizationAiInterface(db, organizationId, row.id, {
        metadata: serializeInterfaceMetadata(nextMetadata),
      });

      return c.json({ results } satisfies VolcanoProbeActivationResponse);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to probe model activation";
      console.error("Error probing volcano activation:", error);
      return c.json({ error: message }, 400);
    }
  }
);

aiInterfaceRoutes.get("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    const row = await getOrganizationAiInterfaceRow(db, organizationId, id);
    if (!row) {
      return c.json({ error: "AI interface not found" }, 404);
    }

    const iface: OrganizationAiInterface = {
      id: row.id,
      organizationId: row.organizationId,
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      name: row.name,
      provider: row.provider as OrganizationAiInterface["provider"],
      baseUrl: row.baseUrl,
      selectedModel: row.selectedModel,
      enabled: row.enabled,
      isDefault: row.isDefault,
      hasApiKey: row.apiKeyEncrypted.length > 0,
      metadata: row.metadata ? parseInterfaceMetadata(row.metadata) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };

    return c.json({ interface: iface });
  } catch (error) {
    console.error("Error fetching organization AI interface:", error);
    return c.json({ error: "Failed to fetch AI interface" }, 500);
  }
});

aiInterfaceRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = createDatabase(c.env);

  try {
    const template = await getAiInterfaceTemplateRow(db, body.templateId);
    if (!template?.enabled) {
      return c.json({ error: "Template not found or disabled" }, 400);
    }

    let apiKeyEncrypted = "";
    let metadataRaw: string | null = null;
    let baseUrl = body.baseUrl ?? null;

    if (body.templateId === VOLCANO_TEMPLATE_ID) {
      const secretAccessKeyEncrypted = await encryptSecret(
        body.secretAccessKey!,
        c.env,
        organizationId
      );
      const metadata = createVolcanoMetadata({
        accessKeyId: body.accessKeyId!,
        secretAccessKeyEncrypted,
        enabledModels: body.enabledModels,
      });
      const issued = await getVolcanoArkApiKey({
        accessKeyId: body.accessKeyId!,
        secretAccessKey: body.secretAccessKey!,
        region: metadata.region,
      });
      metadataRaw = serializeInterfaceMetadata({
        ...metadata,
        arkApiKeyExpiresAt: issued.expiresAt,
      });
      apiKeyEncrypted = await encryptSecret(
        issued.apiKey,
        c.env,
        organizationId
      );
      baseUrl = baseUrl ?? VOLCANO_ARK_INFERENCE_BASE_URL;
    } else {
      apiKeyEncrypted = await encryptSecret(
        body.apiKey!,
        c.env,
        organizationId
      );
      metadataRaw = body.metadata
        ? serializeInterfaceMetadata(body.metadata)
        : null;
    }

    const iface = await createOrganizationAiInterface(db, organizationId, {
      templateId: body.templateId,
      name: body.name,
      provider: template.provider as AiInterfaceProvider,
      templateVersion: body.templateVersion ?? null,
      baseUrl,
      selectedModel: body.selectedModel ?? null,
      enabled: body.enabled,
      isDefault: body.isDefault,
      id: crypto.randomUUID(),
      apiKeyEncrypted,
      metadata: metadataRaw,
    });

    return c.json({ interface: iface }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create AI interface";
    console.error("Error creating organization AI interface:", error);
    return c.json({ error: message }, 400);
  }
});
aiInterfaceRoutes.patch(
  "/:id",
  zValidator("json", updateSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const existing = await getOrganizationAiInterfaceRow(
        db,
        organizationId,
        id
      );
      if (!existing) {
        return c.json({ error: "AI interface not found" }, 404);
      }

      const apiKeyEncrypted =
        body.apiKey !== undefined
          ? await encryptSecret(body.apiKey, c.env, organizationId)
          : undefined;

      let metadataUpdate: Record<string, unknown> | undefined = body.metadata;
      if (body.volcanoModelEnabled) {
        const current = parseInterfaceMetadata(existing.metadata);
        if (!isVolcanoMetadata(current)) {
          return c.json({ error: "Volcano metadata not configured" }, 400);
        }
        metadataUpdate = mergeVolcanoModelEnabled(
          current,
          body.volcanoModelEnabled
        );
      }

      const iface = await updateOrganizationAiInterface(
        db,
        organizationId,
        id,
        {
          name: body.name,
          templateVersion: body.templateVersion,
          baseUrl: body.baseUrl,
          selectedModel: body.selectedModel,
          enabled: body.enabled,
          isDefault: body.isDefault,
          ...(apiKeyEncrypted ? { apiKeyEncrypted } : {}),
          ...(metadataUpdate !== undefined
            ? { metadata: serializeInterfaceMetadata(metadataUpdate) }
            : {}),
        }
      );

      return c.json({ interface: iface });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update AI interface";
      console.error("Error updating organization AI interface:", error);
      const status = message === "AI interface not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  }
);

aiInterfaceRoutes.delete("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    const existing = await getOrganizationAiInterfaceRow(db, organizationId, id);
    if (!existing) {
      return c.json({ error: "AI interface not found" }, 404);
    }

    await deleteOrganizationAiInterface(db, organizationId, id);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization AI interface:", error);
    return c.json({ error: "Failed to delete AI interface" }, 500);
  }
});

export default aiInterfaceRoutes;
