import type {
  AiInterfaceProvider,
  CreateOrganizationAiInterfaceRequest,
  ListOrganizationAiInterfacesResponse,
  OrganizationAiInterface,
  UpdateOrganizationAiInterfaceRequest,
  VolcanoProbeActivationResponse,
  VolcanoProbeCredentialsRequest,
  VolcanoProbeTosBucketsResponse,
  VolcanoSnapshotFetchResponse,
  VolcanoSnapshotResponse,
} from "@dafthunk/types";
import {
  ALL_AI_INTERFACE_PROVIDERS,
  isVolcanoAiInterfaceProvider,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import {
  requireAiInterfacesAccess,
} from "../middleware/org-permissions";
import { createDatabase } from "../db";
import {
  createOrganizationAiInterface,
  deleteOrganizationAiInterface,
  getOrganizationAiInterfaceRow,
  getVolcanoInterfaceRowForOrganization,
  listOrganizationAiInterfaces,
  updateOrganizationAiInterface,
} from "../db/ai-interface-queries";
import {
  getCreateIdempotencyRecord,
  insertCreateIdempotencyRecord,
} from "../db/ai-interface-idempotency-queries";
import { encryptSecret } from "../utils/encryption";
import {
  CREDENTIALS_DECRYPT_FAILED,
  DecryptionFailedError,
} from "../utils/encryption-errors";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { getVolcanoArkApiKey } from "../integrations/volcengine/get-api-key";
import {
  isVolcanoArkNotOpenedError,
  isAiInterfaceNameConflictError,
  isVolcanoInterfaceExistsError,
  VOLCANO_ARK_NOT_OPENED_CODE,
  AI_INTERFACE_NAME_CONFLICT_CODE,
  VOLCANO_INTERFACE_EXISTS_CODE,
} from "../integrations/volcengine/errors";
import { ensureVolcanoApiKey } from "../integrations/volcengine/ensure-api-key";
import { encryptDeferredVolcanoArkApiKey } from "../integrations/volcengine/deferred-api-key";
import { listAggregateVolcanoCatalogEntries } from "../db/platform-ai-model-channel-queries";
import {
  createVolcanoMetadata,
  isVolcanoMetadata,
  mergeVolcanoModelEnabled,
  mergeVolcanoModelAlias,
  mergeVolcanoActivationCache,
  parseInterfaceMetadata,
  resolveVolcanoCatalogEntries,
  serializeInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import {
  mergeSingleModelModelEnabledMetadata,
  mergeSingleModelModelAliasMetadata,
  mergeSingleModelUpstreamModelIdsMetadata,
  parseSingleModelMetadata,
} from "../integrations/single-model/metadata";
import { probeVolcanoModelsActivation } from "../integrations/volcengine/probe-model-activation";
import { buildVolcanoPackageUsageMap } from "../integrations/volcengine/aggregate-package-usage";
import { fetchVolcanoResourcePackages } from "../integrations/volcengine/list-resource-packages";
import { indexResourcePackagesByConfigurationCode } from "../integrations/volcengine/parse-resource-packages";
import {
  buildVolcanoProbeResultsFromPackages,
  enrichVolcanoProbeResultsWithPackages,
  hasProvisionedVolcanoPackageModels,
  normalizeVolcanoWizardProbeResults,
} from "../integrations/volcengine/resolve-volcano-activation";
import { buildVolcanoSnapshot } from "../integrations/volcengine/snapshot";
import { VOLCANO_ARK_INFERENCE_BASE_URL } from "../integrations/volcengine/constants";
import { defaultBaseUrlForProvider } from "@dafthunk/runtime/ai-interface/builtin-artifact";
import { mergeVolcanoTosStorage } from "../services/resolve-org-cloud-storage";
import { refreshOrgCloudStorageHealthAfterConfigChange } from "../services/assert-cloud-storage-healthy-for-generative-media";
import {
  ensureOrgDirectUploadCors,
  readOrgDirectUploadCorsStatus,
} from "../services/ensure-direct-upload-cors";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import {
  probeVolcanoTosServiceStatus,
} from "../integrations/volcengine/probe-volcano-tos-service";
import {
  isVolcanoTosNotOpenedError,
  VOLCANO_TOS_NOT_OPENED_CODE,
} from "../integrations/volcengine/tos-errors";
import { getVolcanoCredentials } from "../integrations/volcengine/ensure-api-key";
import { ensureVolcanoTosBucketCreated } from "../integrations/volcengine/create-volcano-tos-bucket";
import { VOLCANO_TOS_DEFAULT_PREFIX } from "@dafthunk/types";
import type { VolcanoInterfaceSetupQueueMessage } from "@dafthunk/types";
import {
  mergeApiKeyHintIntoMetadata,
  readApiKeyHint,
  withApiKeyHint,
} from "../utils/api-key-hint";

function mapAiInterfaceError(
  c: { json: (body: unknown, status?: number) => Response },
  error: unknown,
  fallbackMessage: string
): Response {
  if (error instanceof DecryptionFailedError) {
    return c.json(
      { error: error.message, code: CREDENTIALS_DECRYPT_FAILED },
      409
    );
  }

  if (isVolcanoArkNotOpenedError(error)) {
    return c.json(
      { error: error.message, code: VOLCANO_ARK_NOT_OPENED_CODE },
      400
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = message === "AI interface not found" ? 404 : 400;
  return c.json({ error: message }, status);
}

const aiInterfaceRoutes = new Hono<ApiContext>();

aiInterfaceRoutes.use("*", jwtMiddleware);
aiInterfaceRoutes.use("*", requireAiInterfacesAccess());
aiInterfaceRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

const providerSchema = z.enum(
  ALL_AI_INTERFACE_PROVIDERS as unknown as [
    (typeof ALL_AI_INTERFACE_PROVIDERS)[number],
    ...(typeof ALL_AI_INTERFACE_PROVIDERS)[number][],
  ]
);

const volcanoActivationResultSchema = z.object({
  canonicalId: z.string(),
  providerModelId: z.string(),
  status: z.enum([
    "open",
    "not_open",
    "service_not_open",
    "invalid_model_id",
    "auth_error",
    "transient_error",
    "unknown",
  ]),
  errorCode: z.string().nullable(),
  message: z.string().nullable(),
  probedAt: z.string(),
});

const createSchema = z
  .object({
    provider: providerSchema,
    name: z.string().trim().min(1).max(120),
    apiKey: z.string().trim().min(1).optional(),
    accessKeyId: z.string().trim().min(1).optional(),
    secretAccessKey: z.string().trim().min(1).optional(),
    enabledModels: z.array(z.string()).optional(),
    volcanoActivationResults: z.array(volcanoActivationResultSchema).optional(),
    baseUrl: z.string().url().nullable().optional(),
    selectedModel: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    tosStorage: z
      .object({
        enabled: z.boolean(),
        bucket: z.string().trim().min(1),
        region: z.string().trim().min(1),
        createBucket: z.boolean().optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (isVolcanoAiInterfaceProvider(value.provider)) {
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
    if (value.provider === "custom" && !value.baseUrl) {
      ctx.addIssue({
        code: "custom",
        message: "Base URL is required for custom providers",
        path: ["baseUrl"],
      });
    }
  }) satisfies z.ZodType<CreateOrganizationAiInterfaceRequest>;

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    apiKey: z.string().trim().min(1).optional(),
    accessKeyId: z.string().trim().min(1).optional(),
    secretAccessKey: z.string().trim().min(1).optional(),
    baseUrl: z.string().url().nullable().optional(),
    selectedModel: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    volcanoModelEnabled: z.record(z.string(), z.boolean()).optional(),
    volcanoModelAlias: z.record(z.string(), z.string()).optional(),
    singleModelModelEnabled: z.record(z.string(), z.boolean()).optional(),
    singleModelModelAlias: z.record(z.string(), z.string()).optional(),
    singleModelUpstreamModelIds: z.record(z.string(), z.string()).optional(),
    tosStorage: z
      .object({
        enabled: z.boolean(),
        bucket: z.string().trim().min(1),
        region: z.string().trim().min(1),
        createBucket: z.boolean().optional(),
      })
      .optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const hasAccessKeyId = value.accessKeyId !== undefined;
    const hasSecretAccessKey = value.secretAccessKey !== undefined;
    if (hasAccessKeyId !== hasSecretAccessKey) {
      ctx.addIssue({
        code: "custom",
        message: "accessKeyId and secretAccessKey must be provided together",
        path: ["accessKeyId"],
      });
    }
  }) satisfies z.ZodType<UpdateOrganizationAiInterfaceRequest>;

const probeCredentialsSchema = z.object({
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  canonicalIds: z.array(z.string()).optional(),
}) satisfies z.ZodType<VolcanoProbeCredentialsRequest>;

const probeTosBucketsSchema = z.object({
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  region: z.string().trim().min(1),
});

const probeActivationSchema = z.object({
  canonicalIds: z.array(z.string()).optional(),
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
  const refreshPackages = c.req.query("refreshPackages") === "1";

  try {
    const result = await buildVolcanoSnapshot({
      env: c.env,
      organizationId,
      interfaceId: id,
      refreshPackages,
    });
    return c.json({
      snapshot: result.snapshot,
      ...(result.refreshLimited ? { refreshLimited: true } : {}),
      ...(result.nextRefreshAt ? { nextRefreshAt: result.nextRefreshAt } : {}),
    } satisfies VolcanoSnapshotFetchResponse);
  } catch (error) {
    if (isVolcanoArkNotOpenedError(error)) {
      return c.json(
        { error: error.message, code: VOLCANO_ARK_NOT_OPENED_CODE },
        400
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to fetch volcano snapshot";
    console.error("Error fetching volcano snapshot:", error);
    const status = message === "AI interface not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

aiInterfaceRoutes.get("/:id/tos-buckets", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const region = c.req.query("region")?.trim();
  if (!region) {
    return c.json({ error: "region is required" }, 400);
  }

  try {
    const db = createDatabase(c.env);
    const row = await getOrganizationAiInterfaceRow(db, organizationId, id);
    if (!row) {
      return c.json({ error: "AI interface not found" }, 404);
    }

    const metadata = parseInterfaceMetadata(row.metadata);
    if (!isVolcanoMetadata(metadata)) {
      return c.json({ error: "Volcano metadata not configured" }, 400);
    }

    const credentials = await getVolcanoCredentials(
      c.env,
      organizationId,
      row.metadata
    );
    if (!credentials) {
      return c.json({ error: "Volcano credentials not configured" }, 400);
    }

    const result = await probeVolcanoTosServiceStatus({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region,
    });
    return c.json(result satisfies VolcanoProbeTosBucketsResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list TOS buckets";
    console.error("Error listing TOS buckets:", error);
    return c.json({ error: message }, 400);
  }
});

aiInterfaceRoutes.post("/:id/ensure-tos-cors", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    const existing = await getOrganizationAiInterfaceRow(db, organizationId, id);
    if (!existing) {
      return c.json({ error: "AI interface not found" }, 404);
    }

    const applied = await ensureOrgDirectUploadCors(c.env, organizationId);
    const health = await refreshOrgCloudStorageHealthAfterConfigChange(
      c.env,
      organizationId
    );
    const corsStatus = await readOrgDirectUploadCorsStatus(c.env, organizationId);

    return c.json({
      applied: applied.applied,
      origins: applied.origins,
      configured: corsStatus.configured,
      health,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to configure bucket CORS";
    console.error("Error ensuring TOS CORS:", error);
    return c.json({ error: message }, 400);
  }
});

aiInterfaceRoutes.post(
  "/volcano-probe-credentials",
  zValidator("json", probeCredentialsSchema),
  async (c) => {
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const credentials = {
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
        region: "cn-beijing" as const,
      };
      const catalogEntries = await listAggregateVolcanoCatalogEntries(db);
      const entries = resolveVolcanoCatalogEntries(
        body.canonicalIds,
        catalogEntries
      );

      const packageFetch = await fetchVolcanoResourcePackages({
        credentials,
        mode: "metering",
      }).catch(() => null);
      const packagesByCode = packageFetch
        ? indexResourcePackagesByConfigurationCode(packageFetch.rows)
        : new Map();
      const { packageByCanonicalId } = buildVolcanoPackageUsageMap({
        catalog: entries,
        packagesByCode,
      });

      let issued: Awaited<ReturnType<typeof getVolcanoArkApiKey>> | null = null;
      try {
        issued = await getVolcanoArkApiKey(credentials);
      } catch (error) {
        if (!isVolcanoArkNotOpenedError(error)) {
          throw error;
        }
        if (hasProvisionedVolcanoPackageModels(packageByCanonicalId)) {
          const results = normalizeVolcanoWizardProbeResults(
            buildVolcanoProbeResultsFromPackages({
              entries,
              packageByCanonicalId,
            })
          );
          return c.json({ results } satisfies VolcanoProbeActivationResponse);
        }
        throw error;
      }

      const [probeResults] = await Promise.all([
        probeVolcanoModelsActivation({
          apiKey: issued.apiKey,
          entries,
        }),
      ]);

      let results = probeResults;
      if (packageFetch) {
        results = enrichVolcanoProbeResultsWithPackages({
          results: probeResults,
          packageByCanonicalId,
        });
      }

      return c.json({
        results: normalizeVolcanoWizardProbeResults(results),
      } satisfies VolcanoProbeActivationResponse);
    } catch (error) {
      if (isVolcanoArkNotOpenedError(error)) {
        return c.json(
          { error: error.message, code: VOLCANO_ARK_NOT_OPENED_CODE },
          400
        );
      }
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
  "/volcano-probe-tos-buckets",
  zValidator("json", probeTosBucketsSchema),
  async (c) => {
    const body = c.req.valid("json");

    try {
      const result = await probeVolcanoTosServiceStatus({
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
        region: body.region,
      });
      return c.json(result satisfies VolcanoProbeTosBucketsResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list TOS buckets";
      console.error("Error probing TOS buckets:", error);
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

      if (ensured.renewed || ensured.metadataChanged) {
        await updateOrganizationAiInterface(db, organizationId, row.id, {
          metadata: ensured.metadataRaw,
          ...(ensured.renewed ? { apiKeyEncrypted: ensured.apiKeyEncrypted } : {}),
        });
      }

      const catalogEntries = await listAggregateVolcanoCatalogEntries(db);
      const entries = resolveVolcanoCatalogEntries(
        body.canonicalIds,
        catalogEntries
      );

      const credentials = await getVolcanoCredentials(
        c.env,
        organizationId,
        row.metadata
      );
      if (!credentials) {
        return c.json({ error: "Volcano credentials not configured" }, 400);
      }

      let results;
      if (ensured.apiKey) {
        results = await probeVolcanoModelsActivation({
          apiKey: ensured.apiKey,
          entries,
        });

        const packageFetch = await fetchVolcanoResourcePackages({
          credentials,
          mode: "metering",
        }).catch(() => null);

        if (packageFetch) {
          const packagesByCode = indexResourcePackagesByConfigurationCode(
            packageFetch.rows
          );
          const { packageByCanonicalId } = buildVolcanoPackageUsageMap({
            catalog: entries,
            packagesByCode,
          });
          results = enrichVolcanoProbeResultsWithPackages({
            results,
            packageByCanonicalId,
          });
        }
      } else {
        const packageFetch = await fetchVolcanoResourcePackages({
          credentials,
          mode: "metering",
        });
        const packagesByCode = indexResourcePackagesByConfigurationCode(
          packageFetch.rows
        );
        const { packageByCanonicalId } = buildVolcanoPackageUsageMap({
          catalog: entries,
          packagesByCode,
        });
        results = buildVolcanoProbeResultsFromPackages({
          entries,
          packageByCanonicalId,
        });
      }

      const nextMetadata = mergeVolcanoActivationCache(
        metadata,
        results,
        catalogEntries
      );
      await updateOrganizationAiInterface(db, organizationId, row.id, {
        metadata: serializeInterfaceMetadata(nextMetadata),
      });

      return c.json({ results } satisfies VolcanoProbeActivationResponse);
    } catch (error) {
      console.error("Error probing volcano activation:", error);
      return mapAiInterfaceError(c, error, "Failed to probe model activation");
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

    const metadata = row.metadata ? parseInterfaceMetadata(row.metadata) : null;
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
      apiKeyHint: readApiKeyHint(metadata),
      metadata,
      volcanoSetupStatus:
        (row.volcanoSetupStatus as OrganizationAiInterface["volcanoSetupStatus"]) ??
        null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };

    return c.json({ interface: iface });
  } catch (error) {
    console.error("Error fetching organization AI interface:", error);
    return c.json({ error: "Failed to fetch AI interface" }, 500);
  }
});

aiInterfaceRoutes.post("/:id/volcano-setup/retry", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    const row = await getOrganizationAiInterfaceRow(db, organizationId, id);
    if (!row) {
      return c.json({ error: "AI interface not found" }, 404);
    }
    if (!isVolcanoAiInterfaceProvider(row.provider)) {
      return c.json({ error: "Not a Volcano interface" }, 400);
    }

    const status = row.volcanoSetupStatus;
    if (status !== "failed" && status !== "enqueue_failed") {
      return c.json(
        { error: "Setup is not in a failed state", status },
        409
      );
    }

    const metadata = parseInterfaceMetadata(row.metadata);
    if (!isVolcanoMetadata(metadata)) {
      return c.json({ error: "Volcano metadata not configured" }, 400);
    }

    const nextMetadata = {
      ...metadata,
      setupStatus: "pending" as const,
      setupError: null,
    };
    await updateOrganizationAiInterface(db, organizationId, id, {
      volcanoSetupStatus: "pending",
      metadata: serializeInterfaceMetadata(nextMetadata),
    });

    const setupMessage: VolcanoInterfaceSetupQueueMessage = {
      kind: "volcano_interface_setup",
      organizationId,
      interfaceId: id,
      idempotencyKey: metadata.setupIdempotencyKey ?? id,
    };

    try {
      await c.env.WORKFLOW_QUEUE.send(setupMessage);
    } catch (enqueueError) {
      console.error("Failed to re-enqueue volcano setup:", enqueueError);
      await updateOrganizationAiInterface(db, organizationId, id, {
        volcanoSetupStatus: "enqueue_failed",
        metadata: serializeInterfaceMetadata({
          ...nextMetadata,
          setupStatus: "enqueue_failed",
          setupError:
            enqueueError instanceof Error
              ? enqueueError.message
              : "Failed to enqueue setup",
        }),
      });
      return c.json({ error: "Failed to enqueue setup" }, 500);
    }

    const refreshed = await getOrganizationAiInterfaceRow(db, organizationId, id);
    if (!refreshed) {
      return c.json({ error: "AI interface not found" }, 404);
    }
    const refreshedMetadata = refreshed.metadata
      ? parseInterfaceMetadata(refreshed.metadata)
      : null;
    return c.json({
      interface: {
        id: refreshed.id,
        organizationId: refreshed.organizationId,
        templateId: refreshed.templateId,
        templateVersion: refreshed.templateVersion,
        name: refreshed.name,
        provider: refreshed.provider as OrganizationAiInterface["provider"],
        baseUrl: refreshed.baseUrl,
        selectedModel: refreshed.selectedModel,
        enabled: refreshed.enabled,
        isDefault: refreshed.isDefault,
        hasApiKey: refreshed.apiKeyEncrypted.length > 0,
        apiKeyHint: readApiKeyHint(refreshedMetadata),
        metadata: refreshedMetadata,
        volcanoSetupStatus:
          (refreshed.volcanoSetupStatus as OrganizationAiInterface["volcanoSetupStatus"]) ??
          null,
        createdAt: refreshed.createdAt.toISOString(),
        updatedAt: refreshed.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error retrying volcano setup:", error);
    return mapAiInterfaceError(c, error, "Failed to retry volcano setup");
  }
});

aiInterfaceRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = createDatabase(c.env);
  const provider = body.provider as AiInterfaceProvider;
  const idempotencyKey =
    c.req.header("Idempotency-Key")?.trim() ||
    c.req.header("idempotency-key")?.trim() ||
    "";

  try {
    if (isVolcanoAiInterfaceProvider(provider)) {
      if (idempotencyKey) {
        const existingIdempotency = await getCreateIdempotencyRecord(
          db,
          idempotencyKey
        );
        if (existingIdempotency) {
          if (existingIdempotency.organizationId !== organizationId) {
            return c.json({ error: "Idempotency key conflict" }, 409);
          }
          const existingIface = await getOrganizationAiInterfaceRow(
            db,
            organizationId,
            existingIdempotency.interfaceId
          );
          if (existingIface) {
            const metadata = existingIface.metadata
              ? parseInterfaceMetadata(existingIface.metadata)
              : null;
            return c.json(
              {
                interface: {
                  id: existingIface.id,
                  organizationId: existingIface.organizationId,
                  templateId: existingIface.templateId,
                  templateVersion: existingIface.templateVersion,
                  name: existingIface.name,
                  provider: existingIface.provider as OrganizationAiInterface["provider"],
                  baseUrl: existingIface.baseUrl,
                  selectedModel: existingIface.selectedModel,
                  enabled: existingIface.enabled,
                  isDefault: existingIface.isDefault,
                  hasApiKey: existingIface.apiKeyEncrypted.length > 0,
                  apiKeyHint: readApiKeyHint(metadata),
                  metadata,
                  volcanoSetupStatus:
                    (existingIface.volcanoSetupStatus as OrganizationAiInterface["volcanoSetupStatus"]) ??
                    null,
                  createdAt: existingIface.createdAt.toISOString(),
                  updatedAt: existingIface.updatedAt.toISOString(),
                },
              },
              201
            );
          }
        }
      }

      const existingVolcano = await getVolcanoInterfaceRowForOrganization(
        db,
        organizationId
      );
      if (existingVolcano) {
        return c.json(
          {
            error: "A Volcano interface already exists in this organization",
            code: VOLCANO_INTERFACE_EXISTS_CODE,
          },
          409
        );
      }

      const secretAccessKeyEncrypted = await encryptSecret(
        body.secretAccessKey!,
        c.env,
        organizationId
      );
      const catalogEntries = await listAggregateVolcanoCatalogEntries(db);
      const metadata = createVolcanoMetadata({
        accessKeyId: body.accessKeyId!,
        secretAccessKeyEncrypted,
        enabledModels: body.enabledModels,
        catalogEntries,
      });
      const metadataWithActivation = body.volcanoActivationResults?.length
        ? mergeVolcanoActivationCache(
            metadata,
            body.volcanoActivationResults,
            catalogEntries
          )
        : metadata;

      const interfaceId = crypto.randomUUID();
      const metadataPending = {
        ...metadataWithActivation,
        arkApiKeyPending: true,
        setupStatus: "pending" as const,
        setupError: null,
        ...(idempotencyKey ? { setupIdempotencyKey: idempotencyKey } : {}),
      };

      const apiKeyEncrypted = await encryptDeferredVolcanoArkApiKey(
        c.env,
        organizationId
      );

      const iface = await createOrganizationAiInterface(db, organizationId, {
        name: body.name,
        provider,
        baseUrl: body.baseUrl ?? VOLCANO_ARK_INFERENCE_BASE_URL,
        selectedModel: body.selectedModel ?? null,
        enabled: body.enabled,
        isDefault: body.isDefault,
        id: interfaceId,
        apiKeyEncrypted,
        metadata: serializeInterfaceMetadata(metadataPending),
        volcanoSetupStatus: "pending",
      });

      if (idempotencyKey) {
        const inserted = await insertCreateIdempotencyRecord(db, {
          key: idempotencyKey,
          organizationId,
          interfaceId,
        });
        if (!inserted) {
          const raced = await getCreateIdempotencyRecord(db, idempotencyKey);
          if (raced && raced.interfaceId !== interfaceId) {
            await deleteOrganizationAiInterface(db, organizationId, interfaceId);
            const winner = await getOrganizationAiInterfaceRow(
              db,
              organizationId,
              raced.interfaceId
            );
            if (winner) {
              const metadata = winner.metadata
                ? parseInterfaceMetadata(winner.metadata)
                : null;
              return c.json(
                {
                  interface: {
                    id: winner.id,
                    organizationId: winner.organizationId,
                    templateId: winner.templateId,
                    templateVersion: winner.templateVersion,
                    name: winner.name,
                    provider: winner.provider as OrganizationAiInterface["provider"],
                    baseUrl: winner.baseUrl,
                    selectedModel: winner.selectedModel,
                    enabled: winner.enabled,
                    isDefault: winner.isDefault,
                    hasApiKey: winner.apiKeyEncrypted.length > 0,
                    apiKeyHint: readApiKeyHint(metadata),
                    metadata,
                    volcanoSetupStatus:
                      (winner.volcanoSetupStatus as OrganizationAiInterface["volcanoSetupStatus"]) ??
                      null,
                    createdAt: winner.createdAt.toISOString(),
                    updatedAt: winner.updatedAt.toISOString(),
                  },
                },
                201
              );
            }
          }
        }
      }

      const setupMessage: VolcanoInterfaceSetupQueueMessage = {
        kind: "volcano_interface_setup",
        organizationId,
        interfaceId,
        idempotencyKey: idempotencyKey || interfaceId,
        ...(body.tosStorage?.enabled
          ? {
              tosSetup: {
                enabled: true,
                region: body.tosStorage.region,
                bucket: body.tosStorage.bucket,
                createBucket: body.tosStorage.createBucket,
              },
            }
          : {}),
      };

      try {
        await c.env.WORKFLOW_QUEUE.send(setupMessage);
      } catch (enqueueError) {
        console.error("Failed to enqueue volcano setup:", enqueueError);
        await updateOrganizationAiInterface(db, organizationId, interfaceId, {
          volcanoSetupStatus: "enqueue_failed",
          metadata: serializeInterfaceMetadata({
            ...metadataPending,
            setupStatus: "enqueue_failed",
            setupError:
              enqueueError instanceof Error
                ? enqueueError.message
                : "Failed to enqueue setup",
          }),
        });
      }

      return c.json({ interface: iface }, 201);
    }

    const apiKeyEncrypted = await encryptSecret(
      body.apiKey!,
      c.env,
      organizationId
    );
    const metadataRaw = serializeInterfaceMetadata(
      mergeApiKeyHintIntoMetadata(
        (body.metadata as Record<string, unknown> | undefined) ?? undefined,
        body.apiKey!
      )
    );

    const iface = await createOrganizationAiInterface(db, organizationId, {
      name: body.name,
      provider,
      baseUrl: body.baseUrl ?? defaultBaseUrlForProvider(provider) ?? null,
      selectedModel: body.selectedModel ?? null,
      enabled: body.enabled,
      isDefault: body.isDefault,
      id: crypto.randomUUID(),
      apiKeyEncrypted,
      metadata: metadataRaw,
    });

    return c.json({ interface: iface }, 201);
  } catch (error) {
    if (isVolcanoArkNotOpenedError(error)) {
      return c.json(
        { error: error.message, code: VOLCANO_ARK_NOT_OPENED_CODE },
        400
      );
    }
    if (isVolcanoInterfaceExistsError(error)) {
      return c.json(
        {
          error: "A Volcano interface already exists in this organization",
          code: VOLCANO_INTERFACE_EXISTS_CODE,
        },
        409
      );
    }
    if (isAiInterfaceNameConflictError(error)) {
      return c.json(
        {
          error: "An AI interface with this name already exists in the organization",
          code: AI_INTERFACE_NAME_CONFLICT_CODE,
        },
        409
      );
    }
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

      let apiKeyEncrypted: string | undefined =
        body.apiKey !== undefined
          ? await encryptSecret(body.apiKey, c.env, organizationId)
          : undefined;

      let metadataUpdate: Record<string, unknown> | undefined = body.metadata;
      const catalogEntries = await listAggregateVolcanoCatalogEntries(db);

      if (body.accessKeyId !== undefined || body.secretAccessKey !== undefined) {
        return c.json({ error: "Credentials cannot be reconfigured" }, 400);
      }

      if (body.volcanoModelEnabled) {
        const current = parseInterfaceMetadata(existing.metadata);
        if (!isVolcanoMetadata(current)) {
          return c.json({ error: "Volcano metadata not configured" }, 400);
        }
        metadataUpdate = mergeVolcanoModelEnabled(
          current,
          body.volcanoModelEnabled,
          catalogEntries
        );
      }

      if (body.volcanoModelAlias) {
        const current = parseInterfaceMetadata(
          metadataUpdate ?? existing.metadata
        );
        if (!isVolcanoMetadata(current)) {
          return c.json({ error: "Volcano metadata not configured" }, 400);
        }
        metadataUpdate = mergeVolcanoModelAlias(
          current,
          body.volcanoModelAlias,
          catalogEntries
        );
      }

      if (body.singleModelModelEnabled) {
        const current = parseSingleModelMetadata(
          metadataUpdate ?? parseInterfaceMetadata(existing.metadata)
        );
        if (!current) {
          return c.json({ error: "Single-model metadata not configured" }, 400);
        }
        metadataUpdate = mergeSingleModelModelEnabledMetadata(
          current,
          body.singleModelModelEnabled
        );
      }

      if (body.singleModelModelAlias) {
        const current = parseSingleModelMetadata(
          metadataUpdate ?? parseInterfaceMetadata(existing.metadata)
        );
        if (!current) {
          return c.json({ error: "Single-model metadata not configured" }, 400);
        }
        metadataUpdate = mergeSingleModelModelAliasMetadata(
          current,
          body.singleModelModelAlias
        );
      }

      if (body.singleModelUpstreamModelIds) {
        for (const modelId of Object.values(body.singleModelUpstreamModelIds)) {
          if (!modelId.trim()) {
            return c.json({ error: "Model ID cannot be empty" }, 400);
          }
        }
        const current = parseSingleModelMetadata(
          metadataUpdate ?? parseInterfaceMetadata(existing.metadata)
        );
        if (!current) {
          return c.json({ error: "Single-model metadata not configured" }, 400);
        }
        metadataUpdate = mergeSingleModelUpstreamModelIdsMetadata(
          current,
          body.singleModelUpstreamModelIds
        );
      }

      if (body.apiKey !== undefined) {
        const baseMetadata =
          metadataUpdate ??
          parseInterfaceMetadata(existing.metadata) ??
          {};
        metadataUpdate = mergeApiKeyHintIntoMetadata(
          baseMetadata as Record<string, unknown>,
          body.apiKey
        );
      }

      if (body.tosStorage) {
        const current = parseInterfaceMetadata(existing.metadata);
        if (!isVolcanoMetadata(current)) {
          return c.json({ error: "Volcano metadata not configured" }, 400);
        }
        const baseMetadata = isVolcanoMetadata(metadataUpdate)
          ? metadataUpdate
          : current;

        let tosBucket = body.tosStorage.bucket;

        if (body.tosStorage.enabled && body.tosStorage.createBucket) {
          const credentials = await getVolcanoCredentials(
            c.env,
            organizationId,
            existing.metadata
          );
          if (!credentials) {
            return c.json({ error: "Volcano credentials not configured" }, 400);
          }

          const probe = await probeVolcanoTosServiceStatus({
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            region: body.tosStorage.region,
          });
          if (probe.status === "not_opened") {
            return c.json(
              {
                error:
                  probe.message ??
                  "The account does not open TOS service.",
                code: VOLCANO_TOS_NOT_OPENED_CODE,
              },
              409
            );
          }
          if (probe.status !== "opened") {
            return c.json(
              {
                error: probe.message ?? "Failed to verify TOS access",
              },
              400
            );
          }

          const client = VolcengineTosClient.forRegion({
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            region: body.tosStorage.region,
          });
          try {
            tosBucket = await ensureVolcanoTosBucketCreated({
              client,
              bucket: tosBucket,
              organizationId,
            });
          } catch (error) {
            if (isVolcanoTosNotOpenedError(error)) {
              return c.json(
                {
                  error: error.message,
                  code: VOLCANO_TOS_NOT_OPENED_CODE,
                },
                409
              );
            }
            throw error;
          }
        }

        metadataUpdate = mergeVolcanoTosStorage(baseMetadata, {
          enabled: body.tosStorage.enabled,
          bucket: tosBucket,
          region: body.tosStorage.region,
          prefix: VOLCANO_TOS_DEFAULT_PREFIX,
        });
      }

      const iface = await updateOrganizationAiInterface(
        db,
        organizationId,
        id,
        {
          name: body.name,
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

      if (body.tosStorage) {
        await refreshOrgCloudStorageHealthAfterConfigChange(
          c.env,
          organizationId
        );
      }

      return c.json({ interface: iface });
    } catch (error) {
      console.error("Error updating organization AI interface:", error);
      return mapAiInterfaceError(c, error, "Failed to update AI interface");
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
