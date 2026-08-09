import {
  countGenerateAiTextMediaReferences,
  countSubmitAiVideoMediaReferences,
  isClientCancelledTextModelError,
  validateAiTextPromptAssembly,
  validateSubmitAiVideoReferences,
  type CompleteGenerationJobUploadRequest,
  type GenerateAiAudioRequest,
  type GenerateAiImageRequest,
  type GenerateAiTextRequest,
  type SubmitAiVideoRequest,
  createEphemeralMediaExpiresAt,
  isEphemeralMediaReference,
  isGrokImagineVideoCanonicalId,
  isVeoCanonicalId,
  type MediaReference,
} from "@dafthunk/types";
import { executeAiInterfaceSync } from "@dafthunk/runtime/ai-interface/execute-sync";
import { executeVolcanoImageGeneration } from "@dafthunk/runtime/ai-interface/execute-volcano-image";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import { createDatabase } from "../db";
import {
  createAiModelInvocation,
  finalizeAiModelInvocation,
  getAiModelInvocation,
  listAiModelInvocations,
  listPlatformAiModelGroups,
} from "../db/platform-ai-model-queries";
import { createUpstreamRequestLogger } from "../services/create-upstream-request-logger";
import { createJobUpstreamRequestLogger } from "../services/job-upstream-request-logger";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { requireModelCallsAccess } from "../middleware/org-permissions";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";
import {
  CloudflareObjectStore,
  buildPresignedUrlConfig,
} from "../runtime/cloudflare-object-store";
import {
  listOrgTextModelOptions,
  resolveTextModelInterface,
} from "../services/resolve-text-model-interface";
import { listPlatformCatalogModelOptions } from "../services/list-platform-catalog-model-options";
import { executeTextModel } from "../services/execute-text-model";
import {
  handleTextModelStreamFailure,
  prepareTextModelStream,
  streamPreparedTextModel,
} from "../services/stream-text-model";
import {
  listOrgImageModelOptions,
  resolveImageModelInterface,
} from "../services/resolve-image-model-interface";
import {
  listOrgVideoModelOptions,
  resolveVideoModelInterface,
} from "../services/resolve-video-model-interface";
import {
  listOrgAudioModelOptions,
  resolveAudioModelInterface,
} from "../services/resolve-audio-model-interface";
import { executeMinimaxSpeech } from "../integrations/minimax/execute-minimax-speech";
import { resolveVolcanoInferenceModelIdAfterEnsure } from "../integrations/volcengine/resolve-inference-model-id";
import {
  downloadOrgVideo,
  pollOrgVideoTask,
  submitOrgVideoTask,
} from "../services/org-video-task";
import { resolveAiImageStorage } from "../services/ai-image-storage";
import { resolveAiAudioStorage } from "../services/ai-audio-storage";
import { resolveAiVideoStorage } from "../services/ai-video-storage";
import {
  getOrgCloudStorageConfiguredResponse,
  getOrgCloudStorageStatusResponse,
} from "../services/assert-cloud-storage-healthy-for-generative-media";
import { ensureOrgDirectUploadCors } from "../services/ensure-direct-upload-cors";
import { shouldThrottleDirectUploadCorsEnsure } from "../services/ensure-direct-upload-cors-throttle";
import {
  cloudStorageUnhealthyResponse,
  runWithCloudStorageGenerativeGate,
} from "../services/cloud-storage-generative-gate";
import { isCloudStorageUnhealthyError } from "../services/classify-cloud-storage-health";
import {
  createGenerationJob,
  getGenerationJobByUpstreamTaskId,
  updateGenerationJob,
  updateGenerationJobStatus,
} from "../db/generation-job-queries";
import {
  completeGenerationJobClientUpload,
  claimClientGenerationJobUpload,
  createReadyToPersistImageJob,
  createReadyToPersistAudioJob,
  GenerationJobUploadValidationError,
  markVideoGenerationJobReadyToPersist,
  pollVideoGenerationJob,
  refreshGenerationJob,
  cancelUserGenerationJob,
  cancelUserGenerationJobByClientRequestId,
  requestServerGenerationJobPersist,
} from "../services/generation-job-service";
import {
  ActiveGenerationJobConflictError,
  assertNoActiveGenerationJobForNode,
  buildAudioGenerateResponseFromJob,
  buildImageGenerateResponseFromJob,
  buildVideoSubmitResponseFromJob,
  findGenerationJobByClientRequestId,
} from "../services/generation-job-guards";
import {
  presignTosMediaDownloadUrls,
  presignTosMediaUpload,
} from "../services/tos-media-presign";
import {
  resolveResourceRefs,
} from "../services/resolve-resource-refs";

const platformAiRoutes = new Hono<ApiContext>();

platformAiRoutes.use("*", jwtMiddleware);
platformAiRoutes.use("*", requireModelCallsAccess());
platformAiRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

platformAiRoutes.get("/storage-status", async (c) => {
  const organizationId = c.get("organizationId")!;
  const scope = c.req.query("scope") ?? "health";
  const force = c.req.query("force") === "true";
  const origin = c.req.query("origin")?.trim();

  if (scope === "configured") {
    return c.json(
      await getOrgCloudStorageConfiguredResponse(c.env, organizationId)
    );
  }

  return c.json(
    await getOrgCloudStorageStatusResponse(c.env, organizationId, {
      force,
      extraCorsOrigins: origin ? [origin] : undefined,
    })
  );
});

const ensureDirectUploadCorsSchema = z.object({
  origin: z.string().min(1).optional(),
});

platformAiRoutes.post(
  "/ensure-direct-upload-cors",
  zValidator("json", ensureDirectUploadCorsSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const origin = body.origin?.trim().replace(/\/$/, "");

    if (origin && shouldThrottleDirectUploadCorsEnsure(organizationId, origin)) {
      return c.json({ applied: false, throttled: true, origin });
    }

    try {
      const result = await ensureOrgDirectUploadCors(c.env, organizationId, {
        extraOrigins: origin ? [origin] : undefined,
      });
      const health = await getOrgCloudStorageStatusResponse(c.env, organizationId, {
        force: true,
        extraCorsOrigins: origin ? [origin] : undefined,
      });

      return c.json({
        applied: result.applied,
        origins: result.origins,
        origin: origin ?? null,
        health: health.health ?? null,
        blocksGenerativeMedia: health.blocksGenerativeMedia,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to configure bucket CORS";
      console.error("Error ensuring direct upload CORS:", error);
      return c.json({ error: message }, 400);
    }
  }
);

const tosPresignUploadSchema = z.object({
  mimeType: z.string().min(1),
  contentLength: z.number().int().positive(),
  workflowId: z.string().optional(),
  mediaKind: z.enum(["ai-image", "ai-video", "ai-audio", "reference"]).optional(),
});

platformAiRoutes.post(
  "/tos/presign-upload",
  zValidator("json", tosPresignUploadSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const mediaKind = body.mediaKind ?? "reference";

    if (
      mediaKind === "ai-image" ||
      mediaKind === "ai-video" ||
      mediaKind === "ai-audio"
    ) {
      const gateResult = await runWithCloudStorageGenerativeGate(
        c,
        organizationId,
        async () => true
      );
      if (gateResult instanceof Response) {
        return gateResult;
      }
    }

    try {
      const result = await presignTosMediaUpload(c.env, {
        organizationId,
        workflowId: body.workflowId,
        mimeType: body.mimeType,
        contentLength: body.contentLength,
        mediaKind,
      });

      if (!result) {
        return c.json({ error: "Cloud storage is not configured" }, 400);
      }

      return c.json(result);
    } catch (error) {
      if (isCloudStorageUnhealthyError(error)) {
        return cloudStorageUnhealthyResponse(c, error);
      }
      throw error;
    }
  }
);

const objectReferenceSchema = z.object({
  id: z.string().min(1),
  mimeType: z.string().min(1),
  filename: z.string().optional(),
  storageKey: z.string().optional(),
  storageBackend: z.enum(["platform", "volcengine_tos"]).optional(),
});

const tosPresignDownloadSchema = z.object({
  references: z.array(objectReferenceSchema).min(1),
});

const resolveResourceRefsSchema = z.object({
  resourceIds: z.array(z.string().min(1)).min(1),
});

platformAiRoutes.post(
  "/resolve-resource-refs",
  zValidator("json", resolveResourceRefsSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");

    try {
      const result = await resolveResourceRefs(c.env, {
        organizationId,
        resourceIds: body.resourceIds,
      });
      return c.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resolve resource refs";
      return c.json({ error: message }, 400);
    }
  }
);

platformAiRoutes.post(
  "/tos/presign-download",
  zValidator("json", tosPresignDownloadSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");

    try {
      const urls = await presignTosMediaDownloadUrls(c.env, {
        organizationId,
        references: body.references,
      });
      return c.json({ urls });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to presign download";
      return c.json({ error: message }, 400);
    }
  }
);

platformAiRoutes.get("/text-models", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const scope = c.req.query("scope");
  if (scope === "catalog") {
    const [models, groups] = await Promise.all([
      listPlatformCatalogModelOptions(db, "text"),
      listPlatformAiModelGroups(db, "text"),
    ]);
    return c.json({ models, groups });
  }
  const [models, groups] = await Promise.all([
    listOrgTextModelOptions(db, organizationId),
    listPlatformAiModelGroups(db, "text"),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/image-models", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const scope = c.req.query("scope");
  if (scope === "catalog") {
    const [models, groups] = await Promise.all([
      listPlatformCatalogModelOptions(db, "image"),
      listPlatformAiModelGroups(db, "image"),
    ]);
    return c.json({ models, groups });
  }
  const [models, groups] = await Promise.all([
    listOrgImageModelOptions(db, organizationId),
    listPlatformAiModelGroups(db, "image"),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/video-models", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const scope = c.req.query("scope");
  if (scope === "catalog") {
    const [models, groups] = await Promise.all([
      listPlatformCatalogModelOptions(db, "video"),
      listPlatformAiModelGroups(db, "video"),
    ]);
    return c.json({ models, groups });
  }
  const [models, groups] = await Promise.all([
    listOrgVideoModelOptions(db, organizationId),
    listPlatformAiModelGroups(db, "video"),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/audio-models", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const scope = c.req.query("scope");
  if (scope === "catalog") {
    const [models, groups] = await Promise.all([
      listPlatformCatalogModelOptions(db, "audio"),
      listPlatformAiModelGroups(db, "audio"),
    ]);
    return c.json({ models, groups });
  }
  const [models, groups] = await Promise.all([
    listOrgAudioModelOptions(db, organizationId),
    listPlatformAiModelGroups(db, "audio"),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/video-models/:canonicalId/resolve", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("aiInterfaceId")?.trim();
  if (!interfaceId) {
    return c.json({ error: "aiInterfaceId is required" }, 400);
  }
  const db = createDatabase(c.env);
  const resolved = await resolveVideoModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId"),
    interfaceId
  );

  if (!resolved) {
    return c.json({ error: "Model is not available for this organization" }, 404);
  }

  return c.json({
    aiInterfaceId: resolved.interfaceId,
    providerModelId: resolved.providerModelId,
  });
});

platformAiRoutes.get("/image-models/:canonicalId/resolve", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("aiInterfaceId")?.trim();
  if (!interfaceId) {
    return c.json({ error: "aiInterfaceId is required" }, 400);
  }
  const db = createDatabase(c.env);
  const resolved = await resolveImageModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId"),
    interfaceId
  );

  if (!resolved) {
    return c.json({ error: "Model is not available for this organization" }, 404);
  }

  return c.json({
    aiInterfaceId: resolved.interfaceId,
    providerModelId: resolved.providerModelId,
  });
});

platformAiRoutes.get("/audio-models/:canonicalId/resolve", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("aiInterfaceId")?.trim();
  if (!interfaceId) {
    return c.json({ error: "aiInterfaceId is required" }, 400);
  }
  const db = createDatabase(c.env);
  const resolved = await resolveAudioModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId"),
    interfaceId
  );

  if (!resolved) {
    return c.json({ error: "Model is not available for this organization" }, 404);
  }

  return c.json({
    aiInterfaceId: resolved.interfaceId,
    providerModelId: resolved.providerModelId,
  });
});

platformAiRoutes.get("/text-models/:canonicalId/resolve", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("aiInterfaceId")?.trim();
  if (!interfaceId) {
    return c.json({ error: "aiInterfaceId is required" }, 400);
  }
  const db = createDatabase(c.env);
  const resolved = await resolveTextModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId"),
    interfaceId
  );

  if (!resolved) {
    return c.json({ error: "Model is not available for this organization" }, 404);
  }

  return c.json({
    aiInterfaceId: resolved.interfaceId,
    providerModelId: resolved.providerModelId,
  });
});

platformAiRoutes.get("/model-calls", async (c) => {
  const organizationId = c.get("organizationId")!;
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const db = createDatabase(c.env);
  const result = await listAiModelInvocations(db, organizationId, {
    limit,
    offset,
  });
  return c.json(result);
});

platformAiRoutes.get("/model-calls/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const invocation = await getAiModelInvocation(
    db,
    organizationId,
    c.req.param("id")
  );
  if (!invocation) {
    return c.json({ error: "Invocation not found" }, 404);
  }
  return c.json({ invocation });
});

const aiTextReferenceSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
});

const referenceImageInlineSchema = z.object({
  mimeType: z.string().min(1),
  data: z.string().min(1),
});

const generateSchema = z.object({
  modelCanonicalId: z.string().min(1),
  aiInterfaceId: z.string().min(1),
  prompt: z.string().optional(),
  references: z.array(aiTextReferenceSchema).optional(),
  referenceImageUrls: z.array(z.string().min(1)).optional(),
  referenceImageInline: z.array(referenceImageInlineSchema).optional(),
  referenceVideoUrls: z.array(z.string().min(1)).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
});

platformAiRoutes.post(
  "/ai-text/generate",
  zValidator("json", generateSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as GenerateAiTextRequest;
    const db = createDatabase(c.env);

    const options = await listOrgTextModelOptions(db, organizationId);
    const modelOption = options.find(
      (entry) =>
        entry.canonicalId === body.modelCanonicalId &&
        entry.interfaceId === body.aiInterfaceId
    );

    if (!modelOption?.selectable) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    const mediaCounts = countGenerateAiTextMediaReferences(body);
    if (mediaCounts.imageCount > modelOption.parameterRules.maxImageReferences) {
      return c.json(
        {
          error: `Model allows at most ${modelOption.parameterRules.maxImageReferences} image references`,
        },
        400
      );
    }
    if (mediaCounts.videoCount > modelOption.parameterRules.maxVideoReferences) {
      return c.json(
        {
          error: `Model allows at most ${modelOption.parameterRules.maxVideoReferences} video references`,
        },
        400
      );
    }

    const assembly = validateAiTextPromptAssembly({
      references: body.references,
      question: body.prompt,
      parameterRules: modelOption.parameterRules,
      mediaReferenceCount: mediaCounts.imageCount + mediaCounts.videoCount,
    });

    if (!assembly.ok) {
      return c.json({ error: assembly.error }, 400);
    }

    const effectivePrompt = assembly.prompt;
    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      effectivePrompt.length > 200
        ? `${effectivePrompt.slice(0, 200)}…`
        : effectivePrompt;

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: modelOption.canonicalId,
      displayName: modelOption.displayName,
      interfaceId: body.aiInterfaceId,
      promptExcerpt,
      content: "",
      source: "ai-text-node-generate",
      status: "pending",
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    });

    const upstreamLog = createUpstreamRequestLogger(db, {
      organizationId,
      interfaceId: body.aiInterfaceId,
      invocationId,
      operation: "submit",
    });

    const result = await executeTextModel({
      env: c.env,
      db,
      organizationId,
      canonicalId: body.modelCanonicalId,
      interfaceId: body.aiInterfaceId,
      effectivePrompt,
      outputMaxTokens: modelOption.parameterRules.outputMaxTokens,
      referenceImageUrls: body.referenceImageUrls,
      referenceImageInline: body.referenceImageInline,
      referenceVideoUrls: body.referenceVideoUrls,
      upstreamLog,
    });

    if (!result.ok || !result.text || !result.interfaceId) {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "failed",
        error: result.invocationError ?? result.error ?? "Generation failed",
      });
      return c.json({ error: result.error ?? "Generation failed" }, 502);
    }

    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      status: "completed",
      content: result.text,
      interfaceId: result.interfaceId,
      interfaceName: result.interfaceName ?? null,
      error: null,
    });

    return c.json({
      text: result.text,
      invocationId,
      aiInterfaceId: result.interfaceId,
    });
  }
);

platformAiRoutes.post(
  "/ai-text/generate-stream",
  zValidator("json", generateSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as GenerateAiTextRequest;
    const db = createDatabase(c.env);

    const options = await listOrgTextModelOptions(db, organizationId);
    const modelOption = options.find(
      (entry) =>
        entry.canonicalId === body.modelCanonicalId &&
        entry.interfaceId === body.aiInterfaceId
    );

    if (!modelOption?.selectable) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    const mediaCounts = countGenerateAiTextMediaReferences(body);
    if (mediaCounts.imageCount > modelOption.parameterRules.maxImageReferences) {
      return c.json(
        {
          error: `Model allows at most ${modelOption.parameterRules.maxImageReferences} image references`,
        },
        400
      );
    }
    if (mediaCounts.videoCount > modelOption.parameterRules.maxVideoReferences) {
      return c.json(
        {
          error: `Model allows at most ${modelOption.parameterRules.maxVideoReferences} video references`,
        },
        400
      );
    }

    const assembly = validateAiTextPromptAssembly({
      references: body.references,
      question: body.prompt,
      parameterRules: modelOption.parameterRules,
      mediaReferenceCount: mediaCounts.imageCount + mediaCounts.videoCount,
    });

    if (!assembly.ok) {
      return c.json({ error: assembly.error }, 400);
    }

    const effectivePrompt = assembly.prompt;
    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      effectivePrompt.length > 200
        ? `${effectivePrompt.slice(0, 200)}…`
        : effectivePrompt;

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: modelOption.canonicalId,
      displayName: modelOption.displayName,
      interfaceId: body.aiInterfaceId,
      promptExcerpt,
      content: "",
      source: "ai-text-node-generate",
      status: "pending",
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    });

    const prepared = await prepareTextModelStream({
      env: c.env,
      db,
      organizationId,
      canonicalId: body.modelCanonicalId,
      interfaceId: body.aiInterfaceId,
      effectivePrompt,
      outputMaxTokens: modelOption.parameterRules.outputMaxTokens,
      referenceImageUrls: body.referenceImageUrls,
      referenceImageInline: body.referenceImageInline,
      referenceVideoUrls: body.referenceVideoUrls,
    });

    if (!prepared.ok) {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "failed",
        error: prepared.invocationError ?? prepared.error,
      });
      return c.json({ error: prepared.error }, 502);
    }

    const upstreamLog = createUpstreamRequestLogger(db, {
      organizationId,
      interfaceId: body.aiInterfaceId,
      invocationId,
      operation: "submit",
    });

    const encoder = new TextEncoder();
    const clientSignal = c.req.raw.signal;
    let finalized = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: unknown): void => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };

        const finalizeCancelled = async (): Promise<void> => {
          if (finalized) {
            return;
          }
          finalized = true;
          await finalizeAiModelInvocation(db, {
            id: invocationId,
            organizationId,
            status: "failed",
            error: "Generation cancelled",
          });
        };

        try {
          for await (const event of streamPreparedTextModel({
            prepared: prepared.prepared,
            signal: clientSignal,
            upstreamLog,
          })) {
            if (clientSignal.aborted) {
              break;
            }

            if (event.type === "delta") {
              send({ type: "delta", text: event.text });
              continue;
            }

            if (event.type === "done") {
              if (!finalized) {
                finalized = true;
                await finalizeAiModelInvocation(db, {
                  id: invocationId,
                  organizationId,
                  status: "completed",
                  content: event.text,
                  interfaceId: prepared.prepared.candidate.interfaceId,
                  interfaceName: prepared.prepared.candidate.interfaceName,
                  error: null,
                });
              }
              send({
                type: "done",
                text: event.text,
                invocationId,
                aiInterfaceId: prepared.prepared.candidate.interfaceId,
              });
              continue;
            }

            if (clientSignal.aborted) {
              break;
            }

            const failure = await handleTextModelStreamFailure({
              db,
              organizationId,
              canonicalId: body.modelCanonicalId,
              candidate: prepared.prepared.candidate,
              upstreamError: event.error,
              displayName: modelOption.displayName,
            });
            if (!finalized) {
              finalized = true;
              await finalizeAiModelInvocation(db, {
                id: invocationId,
                organizationId,
                status: "failed",
                error: failure.invocationError || failure.error,
              });
            }
            send({ type: "error", error: failure.error });
          }

          if (clientSignal.aborted && !finalized) {
            await finalizeCancelled();
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream failed";
          if (!finalized) {
            if (
              clientSignal.aborted ||
              isClientCancelledTextModelError(message)
            ) {
              await finalizeCancelled();
            } else {
              finalized = true;
              const failure = await handleTextModelStreamFailure({
                db,
                organizationId,
                canonicalId: body.modelCanonicalId,
                candidate: prepared.prepared.candidate,
                upstreamError: message,
                displayName: modelOption.displayName,
              });
              await finalizeAiModelInvocation(db, {
                id: invocationId,
                organizationId,
                status: "failed",
                error: failure.invocationError || failure.error,
              });
              try {
                send({ type: "error", error: failure.error });
              } catch {
                // stream already closed
              }
            }
          }
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
);

const generateImageSchema = z.object({
  modelCanonicalId: z.string().min(1),
  aiInterfaceId: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().min(1)).optional(),
  referenceImageInline: z.array(referenceImageInlineSchema).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  clientRequestId: z.string().min(1).max(128).optional(),
});

platformAiRoutes.post(
  "/ai-image/generate",
  zValidator("json", generateImageSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as GenerateAiImageRequest;
    const db = createDatabase(c.env);

    const prompt = body.prompt?.trim() ?? "";
    const hasReferences =
      (body.referenceImageUrls?.length ?? 0) > 0 ||
      (body.referenceImageInline?.length ?? 0) > 0;

    if (!prompt && !hasReferences) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    const existingJob = await findGenerationJobByClientRequestId(db, {
      organizationId,
      clientRequestId: body.clientRequestId,
      modality: "image",
    });
    if (existingJob) {
      return c.json(buildImageGenerateResponseFromJob(existingJob));
    }

    try {
      await assertNoActiveGenerationJobForNode(db, {
        organizationId,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        modality: "image",
        clientRequestId: body.clientRequestId,
      });
    } catch (error) {
      if (error instanceof ActiveGenerationJobConflictError) {
        return c.json(
          {
            error: error.message,
            code: error.code,
            jobId: error.jobId,
          },
          409
        );
      }
      throw error;
    }

    const gateResult = await runWithCloudStorageGenerativeGate(
      c,
      organizationId,
      async () => true
    );
    if (gateResult instanceof Response) {
      return gateResult;
    }

    const resolvedModel = await resolveImageModelInterface(
      db,
      organizationId,
      body.modelCanonicalId,
      body.aiInterfaceId
    );

    if (!resolvedModel) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    if (prompt.length > resolvedModel.parameterRules.promptMaxChars) {
      return c.json(
        {
          error: `Prompt exceeds maximum length of ${resolvedModel.parameterRules.promptMaxChars} characters`,
        },
        400
      );
    }

    const service = new CloudflareAiInterfaceService(c.env);
    const iface = await service.resolveOrgInterface({
      organizationId,
      interfaceId: resolvedModel.interfaceId,
    });

    if (!iface) {
      return c.json({ error: "Could not resolve AI interface" }, 400);
    }

    const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
      db,
      organizationId,
      interfaceId: resolvedModel.interfaceId,
      canonicalId: resolvedModel.canonicalId,
    });

    if (!inferenceModelId) {
      return c.json(
        { error: "Upstream model id is not configured on this AI interface" },
        400
      );
    }

    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      prompt.length > 0
        ? prompt.length > 200
          ? `${prompt.slice(0, 200)}…`
          : prompt
        : "(reference only)";

    const storageResolution = await resolveAiImageStorage(c.env, {
      organizationId,
      workflowId: body.workflowId,
    });

    const deferCloudPersist = storageResolution.storageMode === "cloud";
    const jobId = deferCloudPersist ? crypto.randomUUID() : null;

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: resolvedModel.canonicalId,
      displayName: resolvedModel.displayName,
      interfaceId: resolvedModel.interfaceId,
      interfaceName: resolvedModel.interfaceName,
      promptExcerpt,
      content: "",
      source: "ai-image-node-generate",
      status: "pending",
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    });

    const upstreamLog = createUpstreamRequestLogger(db, {
      organizationId,
      interfaceId: resolvedModel.interfaceId,
      invocationId,
      generationJobId: jobId,
      operation: "submit",
    });

    const result = await executeVolcanoImageGeneration({
      apiKey: iface.apiKey,
      baseUrl: iface.baseUrl,
      providerModelId: inferenceModelId,
      prompt,
      parameterRules: resolvedModel.parameterRules,
      generationParams: body.params,
      referenceImageUrls: body.referenceImageUrls,
      referenceImageInline: body.referenceImageInline,
      storageMode: deferCloudPersist ? "ephemeral" : storageResolution.storageMode,
      objectStore: deferCloudPersist ? undefined : objectStore,
      organizationId,
      workflowId: body.workflowId,
      cloudUpload: deferCloudPersist ? undefined : storageResolution.cloudUpload,
      upstreamLog,
    });

    if (result.status === "failed") {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "failed",
        error: result.error ?? "Generation failed",
      });
      return c.json({ error: result.error ?? "Generation failed" }, 502);
    }

    const images = result.images ?? [];
    if (deferCloudPersist && jobId) {
      const ephemeralImages = images.filter(isEphemeralMediaReference);
      if (ephemeralImages.length !== images.length) {
        await finalizeAiModelInvocation(db, {
          id: invocationId,
          organizationId,
          status: "failed",
          error: "Expected ephemeral upstream image URLs",
        });
        return c.json({ error: "Expected ephemeral upstream image URLs" }, 502);
      }

      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "pending",
        generationJobId: jobId,
        error: null,
      });

      await createReadyToPersistImageJob(db, {
        id: jobId,
        organizationId,
        userId: jwtPayload?.sub,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        modelCanonicalId: resolvedModel.canonicalId,
        interfaceId: resolvedModel.interfaceId,
        images: ephemeralImages,
        clientRequestId: body.clientRequestId,
        invocationId,
        requestSnapshot: result.requestSnapshot,
      });

      return c.json({
        images: [],
        invocationId,
        aiInterfaceId: resolvedModel.interfaceId,
        storageMode: "cloud" as const,
        jobId,
        phase: "ready_to_persist" as const,
        requestedCount: result.requestedCount,
        returnedCount: images.length,
        requestSnapshot: result.requestSnapshot,
      });
    }

    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      status: "completed",
      content: `${result.images?.length ?? 0} image(s)`,
      error: null,
    });

    return c.json({
      images,
      invocationId,
      aiInterfaceId: resolvedModel.interfaceId,
      storageMode: storageResolution.storageMode,
      phase: "succeeded" as const,
      requestedCount: result.requestedCount,
      returnedCount: images.length,
      requestSnapshot: result.requestSnapshot,
    });
  }
);

const generateAudioSchema = z.object({
  modelCanonicalId: z.string().min(1),
  aiInterfaceId: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  clientRequestId: z.string().min(1).max(128).optional(),
});

platformAiRoutes.post(
  "/ai-audio/generate",
  zValidator("json", generateAudioSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as GenerateAiAudioRequest;
    const db = createDatabase(c.env);

    const prompt = body.prompt?.trim() ?? "";
    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    const existingJob = await findGenerationJobByClientRequestId(db, {
      organizationId,
      clientRequestId: body.clientRequestId,
      modality: "audio",
    });
    if (existingJob) {
      return c.json(buildAudioGenerateResponseFromJob(existingJob));
    }

    try {
      await assertNoActiveGenerationJobForNode(db, {
        organizationId,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        modality: "audio",
        clientRequestId: body.clientRequestId,
      });
    } catch (error) {
      if (error instanceof ActiveGenerationJobConflictError) {
        return c.json(
          {
            error: error.message,
            code: error.code,
            jobId: error.jobId,
          },
          409
        );
      }
      throw error;
    }

    const gateResult = await runWithCloudStorageGenerativeGate(
      c,
      organizationId,
      async () => true
    );
    if (gateResult instanceof Response) {
      return gateResult;
    }

    const resolvedModel = await resolveAudioModelInterface(
      db,
      organizationId,
      body.modelCanonicalId,
      body.aiInterfaceId
    );

    if (!resolvedModel) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    if (prompt.length > resolvedModel.parameterRules.promptMaxChars) {
      return c.json(
        {
          error: `Prompt exceeds maximum length of ${resolvedModel.parameterRules.promptMaxChars} characters`,
        },
        400
      );
    }

    const service = new CloudflareAiInterfaceService(c.env);
    const iface = await service.resolveOrgInterface({
      organizationId,
      interfaceId: resolvedModel.interfaceId,
    });

    if (!iface) {
      return c.json({ error: "Could not resolve AI interface" }, 400);
    }

    const storageResolution = await resolveAiAudioStorage(c.env, {
      organizationId,
      workflowId: body.workflowId,
    });

    const deferCloudPersist = storageResolution.storageMode === "cloud";
    const jobId = deferCloudPersist ? crypto.randomUUID() : null;
    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      prompt.length > 200 ? `${prompt.slice(0, 200)}…` : prompt;

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: resolvedModel.canonicalId,
      displayName: resolvedModel.displayName,
      interfaceId: resolvedModel.interfaceId,
      interfaceName: resolvedModel.interfaceName,
      promptExcerpt,
      content: "",
      source: "ai-audio-node-generate",
      status: "pending",
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    });

    const upstreamLog = createUpstreamRequestLogger(db, {
      organizationId,
      interfaceId: resolvedModel.interfaceId,
      invocationId,
      generationJobId: jobId,
      operation: "submit",
    });

    const result = await executeMinimaxSpeech({
      apiKey: iface.apiKey,
      baseUrl: iface.baseUrl,
      providerModelId: resolvedModel.providerModelId,
      text: prompt,
      parameterRules: resolvedModel.parameterRules,
      generationParams: body.params,
      upstreamLog,
    });

    if (result.status === "failed" || !result.audio || !result.mimeType) {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "failed",
        error: result.error ?? "Generation failed",
      });
      return c.json({ error: result.error ?? "Generation failed" }, 502);
    }

    const audioData = new Uint8Array(result.audio);
    const mimeType = result.mimeType;

    if (deferCloudPersist && jobId) {
      const objectStore = new CloudflareObjectStore(
        c.env.RESSOURCES,
        buildPresignedUrlConfig(c.env)
      );
      const ephemeralUrl = await objectStore.writeAndPresign(
        audioData,
        mimeType,
        organizationId
      );
      const ephemeralAudio = {
        kind: "ephemeral" as const,
        url: ephemeralUrl,
        mimeType,
        mediaId: crypto.randomUUID(),
        expiresAt: createEphemeralMediaExpiresAt(),
      };

      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "pending",
        generationJobId: jobId,
        error: null,
      });

      await createReadyToPersistAudioJob(db, {
        id: jobId,
        organizationId,
        userId: jwtPayload?.sub,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        modelCanonicalId: resolvedModel.canonicalId,
        interfaceId: resolvedModel.interfaceId,
        audios: [ephemeralAudio],
        clientRequestId: body.clientRequestId,
        invocationId,
      });

      return c.json({
        audios: [],
        invocationId,
        aiInterfaceId: resolvedModel.interfaceId,
        storageMode: "cloud" as const,
        jobId,
        phase: "ready_to_persist" as const,
      });
    }

    let audios: MediaReference[];

    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    audios = [
      await objectStore.writeObject(audioData, mimeType, organizationId),
    ];

    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      status: "completed",
      content: "1 audio file",
      error: null,
    });

    return c.json({
      audios,
      invocationId,
      aiInterfaceId: resolvedModel.interfaceId,
      storageMode: storageResolution.storageMode,
      phase: "succeeded" as const,
    });
  }
);

const submitVideoSchema = z.object({
  modelCanonicalId: z.string().min(1),
  aiInterfaceId: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().min(1)).optional(),
  referenceImageInline: z.array(referenceImageInlineSchema).optional(),
  referenceVideoUrls: z.array(z.string().min(1)).optional(),
  referenceAudioUrls: z.array(z.string().min(1)).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  clientRequestId: z.string().min(1).max(128).optional(),
});

platformAiRoutes.post(
  "/ai-video/submit",
  zValidator("json", submitVideoSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as SubmitAiVideoRequest;
    const db = createDatabase(c.env);

    const prompt = body.prompt?.trim() ?? "";
    const mediaCounts = countSubmitAiVideoMediaReferences(body);

    const existingJob = await findGenerationJobByClientRequestId(db, {
      organizationId,
      clientRequestId: body.clientRequestId,
      modality: "video",
    });
    if (existingJob) {
      return c.json(buildVideoSubmitResponseFromJob(existingJob));
    }

    try {
      await assertNoActiveGenerationJobForNode(db, {
        organizationId,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        modality: "video",
        clientRequestId: body.clientRequestId,
      });
    } catch (error) {
      if (error instanceof ActiveGenerationJobConflictError) {
        return c.json(
          {
            error: error.message,
            code: error.code,
            jobId: error.jobId,
          },
          409
        );
      }
      throw error;
    }

    const gateResult = await runWithCloudStorageGenerativeGate(
      c,
      organizationId,
      async () => true
    );
    if (gateResult instanceof Response) {
      return gateResult;
    }

    const resolvedModel = await resolveVideoModelInterface(
      db,
      organizationId,
      body.modelCanonicalId,
      body.aiInterfaceId
    );

    if (!resolvedModel) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    const referenceValidation = validateSubmitAiVideoReferences({
      prompt,
      counts: mediaCounts,
      rules: resolvedModel.parameterRules,
    });
    if (!referenceValidation.ok) {
      return c.json({ error: referenceValidation.error }, 400);
    }

    if (prompt.length > resolvedModel.parameterRules.promptMaxChars) {
      return c.json(
        {
          error: `Prompt exceeds maximum length of ${resolvedModel.parameterRules.promptMaxChars} characters`,
        },
        400
      );
    }

    const service = new CloudflareAiInterfaceService(c.env);
    const iface = await service.resolveOrgInterface({
      organizationId,
      interfaceId: resolvedModel.interfaceId,
    });

    if (!iface) {
      return c.json({ error: "Could not resolve AI interface" }, 400);
    }

    const inferenceModelId =
      isVeoCanonicalId(resolvedModel.canonicalId) ||
      isGrokImagineVideoCanonicalId(resolvedModel.canonicalId)
        ? resolvedModel.providerModelId
        : await resolveVolcanoInferenceModelIdAfterEnsure({
            db,
            organizationId,
            interfaceId: resolvedModel.interfaceId,
            canonicalId: resolvedModel.canonicalId,
          });

    if (!inferenceModelId) {
      return c.json(
        { error: "Upstream model id is not configured on this AI interface" },
        400
      );
    }

    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      prompt.length > 0
        ? prompt.length > 200
          ? `${prompt.slice(0, 200)}…`
          : prompt
        : "(reference only)";

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: resolvedModel.canonicalId,
      displayName: resolvedModel.displayName,
      interfaceId: resolvedModel.interfaceId,
      interfaceName: resolvedModel.interfaceName,
      promptExcerpt,
      content: "",
      source: "ai-video-node-submit",
      status: "pending",
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    });

    const upstreamLog = createUpstreamRequestLogger(db, {
      organizationId,
      interfaceId: resolvedModel.interfaceId,
      invocationId,
      operation: "submit",
    });

    const submitResult = await submitOrgVideoTask({
      apiKey: iface.apiKey,
      baseUrl: iface.baseUrl,
      canonicalId: resolvedModel.canonicalId,
      providerModelId: inferenceModelId,
      prompt,
      parameterRules: resolvedModel.parameterRules,
      generationParams: body.params,
      referenceImageUrls: body.referenceImageUrls,
      referenceImageInline: body.referenceImageInline,
      referenceVideoUrls: body.referenceVideoUrls,
      referenceAudioUrls: body.referenceAudioUrls,
      upstreamLog,
    });

    if (submitResult.status === "failed" || !submitResult.taskId) {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "failed",
        error: submitResult.error ?? "Submit failed",
      });
      return c.json({ error: submitResult.error ?? "Submit failed" }, 502);
    }

    const storageResolution = await resolveAiVideoStorage(c.env, {
      organizationId,
      workflowId: body.workflowId,
    });
    const jobId = crypto.randomUUID();
    if (storageResolution.storageMode === "cloud") {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId,
        status: "pending",
        generationJobId: jobId,
        error: null,
      });

      await createGenerationJob(db, {
        id: jobId,
        organizationId,
        userId: jwtPayload?.sub,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        modality: "video",
        status: "generating",
        upstreamTaskId: submitResult.taskId,
        modelCanonicalId: resolvedModel.canonicalId,
        interfaceId: resolvedModel.interfaceId,
        clientRequestId: body.clientRequestId,
        resultJson: {
          upstreamTaskId: submitResult.taskId,
          videoPollUrl: submitResult.pollUrl,
          aiInterfaceId: resolvedModel.interfaceId,
          invocationId,
          nextUpstreamPollAt: new Date().toISOString(),
        },
      });

      return c.json({
        taskId: submitResult.taskId,
        invocationId,
        aiInterfaceId: resolvedModel.interfaceId,
        jobId,
      });
    }

    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      status: "completed",
      content: `task:${submitResult.taskId}`,
      error: null,
    });

    return c.json({
      taskId: submitResult.taskId,
      invocationId,
      aiInterfaceId: resolvedModel.interfaceId,
    });
  }
);

const completeGenerationJobUploadSchema = z.object({
  finalMedia: z.array(objectReferenceSchema).min(1),
});

platformAiRoutes.get("/generation-jobs/:jobId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const jobId = c.req.param("jobId");
  const response = await refreshGenerationJob(c.env, organizationId, jobId);
  if (!response) {
    return c.json({ error: "Generation job not found" }, 404);
  }
  return c.json(response);
});

platformAiRoutes.post("/generation-jobs/:jobId/cancel", async (c) => {
  const organizationId = c.get("organizationId")!;
  const jobId = c.req.param("jobId");
  const response = await cancelUserGenerationJob(c.env, organizationId, jobId);
  if (!response) {
    return c.json({ error: "Generation job not found" }, 404);
  }
  return c.json(response);
});

platformAiRoutes.post("/generation-jobs/cancel-by-client-request", async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = await c.req.json<{ clientRequestId?: string }>();
  const clientRequestId = body.clientRequestId?.trim();
  if (!clientRequestId) {
    return c.json({ error: "clientRequestId is required" }, 400);
  }

  const response = await cancelUserGenerationJobByClientRequestId(
    c.env,
    organizationId,
    clientRequestId
  );
  if (!response) {
    return c.json({ error: "Generation job not found" }, 404);
  }
  return c.json(response);
});

platformAiRoutes.post(
  "/generation-jobs/:jobId/claim-client-upload",
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jobId = c.req.param("jobId");

    const gateResult = await runWithCloudStorageGenerativeGate(
      c,
      organizationId,
      async () => true
    );
    if (gateResult instanceof Response) {
      return gateResult;
    }

    const response = await claimClientGenerationJobUpload(
      c.env,
      organizationId,
      jobId
    );
    if (!response) {
      return c.json({ error: "Generation job not found" }, 404);
    }
    return c.json(response);
  }
);

platformAiRoutes.post(
  "/generation-jobs/:jobId/request-server-persist",
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jobId = c.req.param("jobId");

    const response = await requestServerGenerationJobPersist(
      c.env,
      organizationId,
      jobId
    );
    if (!response) {
      return c.json({ error: "Generation job not found" }, 404);
    }
    return c.json(response);
  }
);

platformAiRoutes.post(
  "/generation-jobs/:jobId/complete-upload",
  zValidator("json", completeGenerationJobUploadSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const jobId = c.req.param("jobId");
    const body = c.req.valid("json") as CompleteGenerationJobUploadRequest;

    const gateResult = await runWithCloudStorageGenerativeGate(
      c,
      organizationId,
      async () => true
    );
    if (gateResult instanceof Response) {
      return gateResult;
    }

    try {
      const response = await completeGenerationJobClientUpload(c.env, {
        organizationId,
        jobId,
        finalMedia: body.finalMedia,
      });
      if (!response) {
        return c.json({ error: "Generation job not found" }, 404);
      }
      return c.json(response);
    } catch (error) {
      if (error instanceof GenerationJobUploadValidationError) {
        return c.json({ error: error.message, code: error.code }, 400);
      }
      throw error;
    }
  }
);

platformAiRoutes.get("/ai-video/tasks/:taskId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const taskId = c.req.param("taskId");
  const interfaceId = c.req.query("aiInterfaceId");
  const db = createDatabase(c.env);

  if (!interfaceId) {
    return c.json({ error: "aiInterfaceId query parameter is required" }, 400);
  }

  const trackedJob = await getGenerationJobByUpstreamTaskId(db, {
    organizationId,
    upstreamTaskId: taskId,
  });
  if (trackedJob?.status === "cancelled") {
    return c.json({
      status: "cancelled" as const,
      error: trackedJob.failureReason ?? "Generation cancelled",
      reason: trackedJob.healthReason ?? undefined,
    });
  }

  const service = new CloudflareAiInterfaceService(c.env);
  const iface = await service.resolveOrgInterface({
    organizationId,
    interfaceId,
  });

  if (!iface) {
    return c.json({ error: "Could not resolve AI interface" }, 400);
  }

  const modelCanonicalId =
    trackedJob?.modelCanonicalId ?? c.req.query("modelCanonicalId")?.trim();
  if (!modelCanonicalId) {
    return c.json(
      { error: "modelCanonicalId query parameter is required" },
      400
    );
  }

  if (trackedJob?.status === "generating") {
    const job = await pollVideoGenerationJob(c.env, db, trackedJob);

    if (job.status === "failed") {
      return c.json({
        status: "failed" as const,
        error: job.failureReason ?? "Poll failed",
      });
    }

    if (job.status === "ready_to_persist") {
      return c.json({ status: "running" as const });
    }

    return c.json({
      status:
        job.resultJson?.upstreamVideoStatus === "queued"
          ? ("queued" as const)
          : ("running" as const),
    });
  }

  const pollLog = trackedJob
    ? createJobUpstreamRequestLogger(db, trackedJob, "poll")
    : createUpstreamRequestLogger(db, {
        organizationId,
        interfaceId,
        operation: "poll",
      });

  const pollResult = await pollOrgVideoTask({
    apiKey: iface.apiKey,
    canonicalId: modelCanonicalId,
    baseUrl: iface.baseUrl,
    upstreamTaskId: taskId,
    videoPollUrl: trackedJob?.resultJson?.videoPollUrl,
    upstreamLog: pollLog,
  });

  if (pollResult.status === "failed") {
    if (trackedJob) {
      await updateGenerationJobStatus(db, {
        id: trackedJob.id,
        organizationId,
        status: "failed",
        failureReason: pollResult.error ?? "Poll failed",
      });
    }
    return c.json({
      status: "failed" as const,
      error: pollResult.error ?? "Poll failed",
    });
  }

  if (pollResult.status === "completed" && pollResult.videoUrl) {
    const workflowId = c.req.query("workflowId")?.trim() || undefined;
    const storageResolution = await resolveAiVideoStorage(c.env, {
      organizationId,
      workflowId,
    });

    if (storageResolution.storageMode === "cloud") {
      if (!trackedJob) {
        return c.json(
          {
            error:
              "Cloud video generation must use generation jobs; resubmit via /ai-video/submit",
            code: "generation_job_required",
          },
          409
        );
      }

      const gateResult = await runWithCloudStorageGenerativeGate(
        c,
        organizationId,
        async () => true
      );
      if (gateResult instanceof Response) {
        await updateGenerationJobStatus(db, {
          id: trackedJob.id,
          organizationId,
          status: "cancelled",
          failureReason: "cloud_storage_unhealthy",
          healthReason: "blocked",
        });
        return c.json({
          status: "cancelled" as const,
          error: "Cloud storage is unavailable",
          reason: "cloud_storage_unhealthy",
        });
      }

      await markVideoGenerationJobReadyToPersist(db, {
        job: trackedJob,
        videoUrl: pollResult.videoUrl,
      });

      return c.json({ status: "running" as const });
    }

    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);

    const downloadResult = await downloadOrgVideo({
      apiKey: iface.apiKey,
      canonicalId: modelCanonicalId,
      videoUrl: pollResult.videoUrl,
      storageMode: storageResolution.storageMode,
      objectStore,
      organizationId,
      workflowId,
      cloudUpload: storageResolution.cloudUpload,
    });

    if (downloadResult.status === "failed") {
      return c.json({
        status: "failed" as const,
        error: downloadResult.error ?? "Failed to store generated video",
      });
    }

    return c.json({
      status: "succeeded" as const,
      videoUrl: pollResult.videoUrl,
      videos: downloadResult.videos,
    });
  }

  return c.json({
    status:
      pollResult.upstreamPhase === "queued"
        ? ("queued" as const)
        : ("running" as const),
  });
});

platformAiRoutes.get("/media/proxy", async (c) => {
  const upstreamUrl = c.req.query("url")?.trim();
  const mimeType = c.req.query("mimeType")?.trim() || "application/octet-stream";

  if (!upstreamUrl) {
    return c.json({ error: "url query parameter is required" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(upstreamUrl);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return c.json({ error: "Invalid url protocol" }, 400);
  }

  const response = await fetch(upstreamUrl);
  if (!response.ok) {
    return c.json(
      { error: `Upstream fetch failed (${response.status})` },
      502
    );
  }

  return new Response(response.body, {
    headers: {
      "content-type": mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export default platformAiRoutes;
