import {
  resolveAiTextEffectivePrompt,
  type GenerateAiImageRequest,
  type GenerateAiTextRequest,
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
import { resolveAiImageStorage } from "../services/ai-image-storage";
import { isOrgCloudStorageConfigured } from "../services/resolve-org-cloud-storage";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";

const platformAiRoutes = new Hono<ApiContext>();

platformAiRoutes.use("*", jwtMiddleware);
platformAiRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

platformAiRoutes.get("/storage-status", async (c) => {
  const organizationId = c.req.param("organizationId");
  const db = createDatabase(c.env);
  const interfaces = await listOrganizationAiInterfaces(db, organizationId);
  return c.json({
    configured: isOrgCloudStorageConfigured(interfaces),
  });
});

platformAiRoutes.get("/text-models", async (c) => {
  const organizationId = c.req.param("organizationId");
  const db = createDatabase(c.env);
  const [models, groups] = await Promise.all([
    listOrgTextModelOptions(db, organizationId),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/image-models", async (c) => {
  const organizationId = c.req.param("organizationId");
  const db = createDatabase(c.env);
  const [models, groups] = await Promise.all([
    listOrgImageModelOptions(db, organizationId),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
});

platformAiRoutes.get("/image-models/:canonicalId/resolve", async (c) => {
  const organizationId = c.req.param("organizationId");
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
  const organizationId = c.req.param("organizationId");
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
  const organizationId = c.req.param("organizationId");
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
    const organizationId = c.req.param("organizationId");
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
  const organizationId = c.req.param("organizationId");
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
  const organizationId = c.req.param("organizationId");
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

const generateSchema = z.object({
  modelCanonicalId: z.string().min(1),
  prompt: z.string().optional(),
  keywords: z.string().optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
});

platformAiRoutes.post(
  "/ai-text/generate",
  zValidator("json", generateSchema),
  async (c) => {
    const organizationId = c.req.param("organizationId");
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as GenerateAiTextRequest;
    const db = createDatabase(c.env);

    const effectivePrompt = resolveAiTextEffectivePrompt({
      keywords: body.keywords,
      prompt: body.prompt,
    });

    if (!effectivePrompt) {
      return c.json({ error: "Prompt or keywords is required" }, 400);
    }

    const resolvedModel = await resolveTextModelInterface(
      db,
      organizationId,
      body.modelCanonicalId
    );

    if (!resolvedModel) {
      return c.json({ error: "Model is not available for this organization" }, 400);
    }

    const usesKeywords =
      typeof body.keywords === "string" && body.keywords.trim().length > 0;
    const maxChars = usesKeywords
      ? resolvedModel.parameterRules.keywordsMaxChars
      : resolvedModel.parameterRules.promptMaxChars;

    if (effectivePrompt.length > maxChars) {
      return c.json(
        {
          error: `Input exceeds maximum length of ${maxChars} characters for this model`,
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

const generateImageSchema = z.object({
  modelCanonicalId: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
});

platformAiRoutes.post(
  "/ai-image/generate",
  zValidator("json", generateImageSchema),
  async (c) => {
    const organizationId = c.req.param("organizationId");
    const jwtPayload = c.get("jwtPayload");
    const body = c.req.valid("json") as GenerateAiImageRequest;
    const db = createDatabase(c.env);

    const prompt = body.prompt?.trim() ?? "";
    if (!prompt) {
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
      prompt.length > 200 ? `${prompt.slice(0, 200)}…` : prompt;

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

export default platformAiRoutes;
