import {
  validateAiTextPromptAssembly,
  type GenerateAiImageRequest,
  type GenerateAiTextRequest,
  type SubmitAiVideoRequest,
} from "@dafthunk/types";
import { executeAiInterfaceSync } from "@dafthunk/runtime/ai-interface/execute-sync";
import { executeVolcanoImageGeneration } from "@dafthunk/runtime/ai-interface/execute-volcano-image";
import {
  downloadVolcanoVideo,
  pollVolcanoVideoTask,
  submitVolcanoVideoTask,
} from "@dafthunk/runtime/ai-interface/execute-volcano-video";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import { createDatabase } from "../db";
import {
  createAiModelInvocation,
  getAiModelInvocation,
  listAiModelInvocations,
  listPlatformAiModelGroups,
  upsertModelInterfacePriority,
} from "../db/platform-ai-model-queries";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";
import { CloudflareObjectStore } from "../runtime/cloudflare-object-store";
import {
  listOrgTextModelOptions,
  resolveTextModelInterface,
} from "../services/resolve-text-model-interface";
import {
  listOrgImageModelOptions,
  resolveImageModelInterface,
} from "../services/resolve-image-model-interface";
import {
  listOrgVideoModelOptions,
  resolveVideoModelInterface,
} from "../services/resolve-video-model-interface";
import { resolveAiImageStorage } from "../services/ai-image-storage";
import { resolveAiVideoStorage } from "../services/ai-video-storage";
import { isOrgCloudStorageConfigured } from "../services/resolve-org-cloud-storage";
import {
  presignTosMediaDownloadUrls,
  presignTosMediaUpload,
} from "../services/tos-media-presign";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";

const platformAiRoutes = new Hono<ApiContext>();

platformAiRoutes.use("*", jwtMiddleware);
platformAiRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

platformAiRoutes.get("/storage-status", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const interfaces = await listOrganizationAiInterfaces(db, organizationId);
  return c.json({
    configured: isOrgCloudStorageConfigured(interfaces),
  });
});

const tosPresignUploadSchema = z.object({
  mimeType: z.string().min(1),
  contentLength: z.number().int().positive(),
  workflowId: z.string().optional(),
  mediaKind: z.enum(["ai-image", "ai-video", "reference"]).optional(),
});

platformAiRoutes.post(
  "/tos/presign-upload",
  zValidator("json", tosPresignUploadSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const result = await presignTosMediaUpload(c.env, {
      organizationId,
      workflowId: body.workflowId,
      mimeType: body.mimeType,
      contentLength: body.contentLength,
      mediaKind: body.mediaKind ?? "reference",
    });

    if (!result) {
      return c.json({ error: "Cloud storage is not configured" }, 400);
    }

    return c.json(result);
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
  const [models, groups] = await Promise.all([
    listOrgTextModelOptions(db, organizationId),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/image-models", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const [models, groups] = await Promise.all([
    listOrgImageModelOptions(db, organizationId),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/video-models", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const [models, groups] = await Promise.all([
    listOrgVideoModelOptions(db, organizationId),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/video-models/:canonicalId/resolve", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const resolved = await resolveVideoModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId")
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
  const db = createDatabase(c.env);
  const resolved = await resolveImageModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId")
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
  const db = createDatabase(c.env);
  const resolved = await resolveTextModelInterface(
    db,
    organizationId,
    c.req.param("canonicalId")
  );

  if (!resolved) {
    return c.json({ error: "Model is not available for this organization" }, 404);
  }

  return c.json({
    aiInterfaceId: resolved.interfaceId,
    providerModelId: resolved.providerModelId,
  });
});

platformAiRoutes.get("/model-interface-priorities", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const { listModelInterfacePriorities } = await import(
    "../db/platform-ai-model-queries"
  );
  const priorities = await listModelInterfacePriorities(db, organizationId);
  return c.json({ priorities });
});

const prioritySchema = z.object({
  canonicalId: z.string().min(1),
  interfaceIds: z.array(z.string()),
});

platformAiRoutes.put(
  "/model-interface-priorities",
  zValidator("json", prioritySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const db = createDatabase(c.env);
    const priority = await upsertModelInterfacePriority(
      db,
      organizationId,
      body.canonicalId,
      body.interfaceIds
    );
    return c.json({ priority });
  }
);

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

const generateSchema = z.object({
  modelCanonicalId: z.string().min(1),
  prompt: z.string().optional(),
  references: z.array(aiTextReferenceSchema).optional(),
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

    const resolvedModel = await resolveTextModelInterface(
      db,
      organizationId,
      body.modelCanonicalId
    );

    if (!resolvedModel) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    const assembly = validateAiTextPromptAssembly({
      references: body.references,
      question: body.prompt,
      parameterRules: resolvedModel.parameterRules,
    });

    if (!assembly.ok) {
      return c.json({ error: assembly.error }, 400);
    }

    const effectivePrompt = assembly.prompt;

    const service = new CloudflareAiInterfaceService(c.env);
    const iface = await service.resolveOrgInterface({
      organizationId,
      interfaceId: resolvedModel.interfaceId,
    });

    if (!iface) {
      return c.json({ error: "Could not resolve AI interface" }, 400);
    }

    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      effectivePrompt.length > 200
        ? `${effectivePrompt.slice(0, 200)}…`
        : effectivePrompt;

    const result = await executeAiInterfaceSync({
      resolved: {
        ...iface,
        selectedModel: resolvedModel.providerModelId,
      },
      inputs: {
        prompt: effectivePrompt,
      },
      bodyExtensions: {
        max_tokens: resolvedModel.parameterRules.outputMaxTokens,
      },
    });

    if (result.status === "failed") {
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
        source: "ai-text-node-generate",
        status: "failed",
        error: result.error ?? "Generation failed",
      });
      return c.json({ error: result.error ?? "Generation failed" }, 502);
    }

    const text =
      typeof result.outputs?.text === "string"
        ? result.outputs.text
        : typeof result.outputs?.content === "string"
          ? result.outputs.content
          : "";

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: resolvedModel.canonicalId,
      displayName: resolvedModel.displayName,
      interfaceId: resolvedModel.interfaceId,
      interfaceName: resolvedModel.interfaceName,
      promptExcerpt,
      content: text,
      source: "ai-text-node-generate",
      status: "completed",
    });

    return c.json({
      text,
      invocationId,
      aiInterfaceId: resolvedModel.interfaceId,
    });
  }
);

const referenceImageInlineSchema = z.object({
  mimeType: z.string().min(1),
  data: z.string().min(1),
});

const generateImageSchema = z.object({
  modelCanonicalId: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().min(1)).optional(),
  referenceImageInline: z.array(referenceImageInlineSchema).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
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

    const resolvedModel = await resolveImageModelInterface(
      db,
      organizationId,
      body.modelCanonicalId
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

    const result = await executeVolcanoImageGeneration({
      apiKey: iface.apiKey,
      baseUrl: iface.baseUrl,
      providerModelId: resolvedModel.providerModelId,
      prompt,
      parameterRules: resolvedModel.parameterRules,
      generationParams: body.params,
      referenceImageUrls: body.referenceImageUrls,
      referenceImageInline: body.referenceImageInline,
      storageMode: storageResolution.storageMode,
      objectStore:
        storageResolution.storageMode === "cloud" &&
        !storageResolution.cloudUpload
          ? objectStore
          : undefined,
      organizationId,
      workflowId: body.workflowId,
      cloudUpload: storageResolution.cloudUpload,
    });

    if (result.status === "failed") {
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
        status: "failed",
        error: result.error ?? "Generation failed",
      });
      return c.json({ error: result.error ?? "Generation failed" }, 502);
    }

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: resolvedModel.canonicalId,
      displayName: resolvedModel.displayName,
      interfaceId: resolvedModel.interfaceId,
      interfaceName: resolvedModel.interfaceName,
      promptExcerpt,
      content: `${result.images?.length ?? 0} image(s)`,
      source: "ai-image-node-generate",
      status: "completed",
    });

    return c.json({
      images: result.images ?? [],
      invocationId,
      aiInterfaceId: resolvedModel.interfaceId,
      storageMode: result.storageMode ?? storageResolution.storageMode,
    });
  }
);

const submitVideoSchema = z.object({
  modelCanonicalId: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().min(1)).optional(),
  referenceImageInline: z.array(referenceImageInlineSchema).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
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
    const hasReferences =
      (body.referenceImageUrls?.length ?? 0) > 0 ||
      (body.referenceImageInline?.length ?? 0) > 0;

    if (!prompt && !hasReferences) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    const resolvedModel = await resolveVideoModelInterface(
      db,
      organizationId,
      body.modelCanonicalId
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

    const invocationId = crypto.randomUUID();
    const promptExcerpt =
      prompt.length > 0
        ? prompt.length > 200
          ? `${prompt.slice(0, 200)}…`
          : prompt
        : "(reference only)";

    const submitResult = await submitVolcanoVideoTask({
      apiKey: iface.apiKey,
      baseUrl: iface.baseUrl,
      providerModelId: resolvedModel.providerModelId,
      prompt,
      parameterRules: resolvedModel.parameterRules,
      generationParams: body.params,
      referenceImageUrls: body.referenceImageUrls,
      referenceImageInline: body.referenceImageInline,
    });

    if (submitResult.status === "failed" || !submitResult.taskId) {
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
        status: "failed",
        error: submitResult.error ?? "Submit failed",
      });
      return c.json({ error: submitResult.error ?? "Submit failed" }, 502);
    }

    await createAiModelInvocation(db, {
      id: invocationId,
      organizationId,
      userId: jwtPayload?.sub,
      canonicalId: resolvedModel.canonicalId,
      displayName: resolvedModel.displayName,
      interfaceId: resolvedModel.interfaceId,
      interfaceName: resolvedModel.interfaceName,
      promptExcerpt,
      content: `task:${submitResult.taskId}`,
      source: "ai-video-node-submit",
      status: "completed",
    });

    return c.json({
      taskId: submitResult.taskId,
      invocationId,
      aiInterfaceId: resolvedModel.interfaceId,
    });
  }
);

platformAiRoutes.get("/ai-video/tasks/:taskId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const taskId = c.req.param("taskId");
  const interfaceId = c.req.query("aiInterfaceId");

  if (!interfaceId) {
    return c.json({ error: "aiInterfaceId query parameter is required" }, 400);
  }

  const service = new CloudflareAiInterfaceService(c.env);
  const iface = await service.resolveOrgInterface({
    organizationId,
    interfaceId,
  });

  if (!iface) {
    return c.json({ error: "Could not resolve AI interface" }, 400);
  }

  const baseUrl = iface.baseUrl.replace(/\/$/, "");
  const pollResult = await pollVolcanoVideoTask({
    apiKey: iface.apiKey,
    pollUrl: `${baseUrl}/contents/generations/tasks/${taskId}`,
  });

  if (pollResult.status === "failed") {
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
    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);

    const downloadResult = await downloadVolcanoVideo({
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

  return c.json({ status: "running" as const });
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
