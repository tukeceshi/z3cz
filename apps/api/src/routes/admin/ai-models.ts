import type {
  CreatePlatformAiModelGroupRequest,
  UpdatePlatformAiModelGroupRequest,
  UpdatePlatformAiModelRequest,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import { createDatabase } from "../../db";
import {
  createPlatformAiModelGroup,
  deletePlatformAiModelGroup,
  listPlatformAiModelGroups,
  listPlatformAiModels,
  updatePlatformAiModel,
  updatePlatformAiModelGroup,
} from "../../db/platform-ai-model-queries";

const adminAiModelsRoutes = new Hono<ApiContext>();

const textRulesSchema = z.object({
  schemaVersion: z.literal(1),
  referenceInputs: z.array(
    z.object({
      type: z.enum(["string", "image", "video", "any"]),
      field: z.literal("keywords"),
      maxCount: z.number().int().positive(),
    })
  ),
  keywordsMaxChars: z.number().int().positive(),
  promptMaxChars: z.number().int().positive(),
  outputMaxTokens: z.number().int().positive(),
  outputMaxTokensLimit: z.number().int().positive(),
  outputMaxChars: z.number().int().positive().max(32_000),
  contextWindowTokens: z.number().int().positive(),
  maxTextReferences: z.number().int().nonnegative(),
  maxTextReferenceChars: z.number().int().positive(),
  maxImageReferences: z.number().int().nonnegative(),
  maxImageReferenceBytes: z.number().int().positive(),
  maxVideoReferences: z.number().int().nonnegative(),
  maxVideoReferenceBytes: z.number().int().positive(),
  maxVideoReferenceSeconds: z.number().int().positive(),
});

const generationFieldSchema = z.object({
  name: z.string().min(1),
  apiName: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "json"]),
  description: z.string(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  hidden: z.boolean().optional(),
  enumValues: z.array(z.string()).optional(),
});

const imageRulesSchema = z.object({
  schemaVersion: z.literal(1),
  maxReferenceImages: z.number().int().nonnegative(),
  maxImageReferenceBytes: z.number().int().positive(),
  promptMaxChars: z.number().int().positive(),
  generationFields: z.array(generationFieldSchema),
});

const videoRulesSchema = z.object({
  schemaVersion: z.literal(1),
  maxReferenceImages: z.number().int().nonnegative(),
  maxImageReferenceBytes: z.number().int().positive(),
  maxReferenceVideos: z.number().int().nonnegative(),
  maxVideoReferenceBytes: z.number().int().positive(),
  maxVideoReferenceSeconds: z.number().int().positive(),
  promptMaxChars: z.number().int().positive(),
  generationFields: z.array(generationFieldSchema),
});

const parameterRulesSchema = z.union([
  textRulesSchema,
  imageRulesSchema,
  videoRulesSchema,
]);

const patchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  platformEnabled: z.boolean().optional(),
  providerModelId: z.string().trim().min(1).optional(),
  parameterRules: parameterRulesSchema.optional(),
  sortOrder: z.number().int().optional(),
  groupId: z.string().trim().min(1).nullable().optional(),
  description: z.string().optional(),
});

const reorderSchema = z.object({
  orderedCanonicalIds: z.array(z.string().min(1)).min(1),
});

const createGroupSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  icon: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.number().int().optional(),
});

const patchGroupSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.number().int().optional(),
});

adminAiModelsRoutes.get("/", async (c) => {
  const modality = c.req.query("modality");
  const db = createDatabase(c.env);
  const [models, groups] = await Promise.all([
    listPlatformAiModels(
      db,
      modality === "text" || modality === "image" || modality === "video"
        ? modality
        : undefined
    ),
    listPlatformAiModelGroups(db),
  ]);
  return c.json({ models, groups });
});

adminAiModelsRoutes.get("/groups", async (c) => {
  const db = createDatabase(c.env);
  const groups = await listPlatformAiModelGroups(db);
  return c.json({ groups });
});

adminAiModelsRoutes.post(
  "/groups",
  zValidator("json", createGroupSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const body = c.req.valid("json") as CreatePlatformAiModelGroupRequest;
    try {
      const group = await createPlatformAiModelGroup(db, body);
      return c.json({ group }, 201);
    } catch {
      return c.json({ error: "Failed to create group (id may exist)" }, 409);
    }
  }
);

adminAiModelsRoutes.patch(
  "/groups/:groupId",
  zValidator("json", patchGroupSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const body = c.req.valid("json") as UpdatePlatformAiModelGroupRequest;
    const group = await updatePlatformAiModelGroup(
      db,
      c.req.param("groupId"),
      body
    );
    if (!group) {
      return c.json({ error: "Group not found" }, 404);
    }
    return c.json({ group });
  }
);

adminAiModelsRoutes.delete("/groups/:groupId", async (c) => {
  const db = createDatabase(c.env);
  const deleted = await deletePlatformAiModelGroup(db, c.req.param("groupId"));
  if (!deleted) {
    return c.json({ error: "Group not found" }, 404);
  }
  return c.json({ ok: true });
});

adminAiModelsRoutes.put(
  "/reorder",
  zValidator("json", reorderSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const { orderedCanonicalIds } = c.req.valid("json");
    for (let index = 0; index < orderedCanonicalIds.length; index++) {
      const canonicalId = orderedCanonicalIds[index]!;
      await updatePlatformAiModel(db, canonicalId, {
        sortOrder: (index + 1) * 10,
      });
    }
    const [models, groups] = await Promise.all([
      listPlatformAiModels(db, "text"),
      listPlatformAiModelGroups(db),
    ]);
    return c.json({ models, groups });
  }
);

adminAiModelsRoutes.patch(
  "/:canonicalId",
  zValidator("json", patchSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const body = c.req.valid("json") as UpdatePlatformAiModelRequest;
    const updated = await updatePlatformAiModel(
      db,
      c.req.param("canonicalId"),
      body
    );
    if (!updated) {
      return c.json({ error: "Model not found" }, 404);
    }
    return c.json({ model: updated });
  }
);

export default adminAiModelsRoutes;
