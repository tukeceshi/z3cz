import {
  resolveAiTextEffectivePrompt,
  type GenerateAiTextRequest,
} from "@dafthunk/types";
import { executeAiInterfaceSync } from "@dafthunk/runtime/ai-interface/execute-sync";
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
import {
  listOrgTextModelOptions,
  resolveTextModelInterface,
} from "../services/resolve-text-model-interface";

const platformAiRoutes = new Hono<ApiContext>();

platformAiRoutes.use("*", jwtMiddleware);
platformAiRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

platformAiRoutes.get("/text-models", async (c) => {
  const organizationId = c.req.param("organizationId");
  const db = createDatabase(c.env);
  const [models, groups] = await Promise.all([
    listOrgTextModelOptions(db, organizationId),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
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

export default platformAiRoutes;
