import type { UpdatePlatformAiModelRequest } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import { createDatabase } from "../../db";
import {
  listPlatformAiModels,
  updatePlatformAiModel,
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
  apiName: z.string(),
  type: z.enum(["string", "number", "boolean", "json"]),
  description: z.string(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  hidden: z.boolean().optional(),
  clientOnly: z.boolean().optional(),
  enumValues: z.array(z.string()).optional(),
});

const sizePolicySchema = z.object({
  enabled: z.boolean(),
  effectMode: z.enum(["legacy", "k_only", "ratio_prompt", "pixel_size"]),
});

const countPolicySchema = z.object({
  enabled: z.boolean(),
  effectMode: z.enum(["direct", "sequential", "sequential_image_generation"]),
});

const videoRulesSchema = z.object({
  schemaVersion: z.literal(1),
  sizePolicy: sizePolicySchema.optional(),
  maxReferenceImages: z.number().int().nonnegative(),
  maxImageReferenceBytes: z.number().int().positive(),
  maxReferenceVideos: z.number().int().nonnegative(),
  maxVideoReferenceBytes: z.number().int().positive(),
  maxVideoReferenceSeconds: z.number().int().positive(),
  maxReferenceAudios: z.number().int().nonnegative(),
  maxAudioReferenceBytes: z.number().int().positive(),
  maxAudioReferenceSeconds: z.number().int().positive(),
  promptMaxChars: z.number().int().positive(),
  generationFields: z.array(generationFieldSchema),
});

const audioRulesSchema = z.object({
  schemaVersion: z.literal(1),
  promptMaxChars: z.number().int().positive(),
  generationFields: z.array(generationFieldSchema),
});

const imageRulesSchema = z
  .object({
    schemaVersion: z.literal(1),
    sizePolicy: sizePolicySchema.optional(),
    countPolicy: countPolicySchema.optional(),
    maxReferenceImages: z.number().int().nonnegative(),
    maxImageReferenceBytes: z.number().int().positive(),
    promptMaxChars: z.number().int().positive(),
    generationFields: z.array(generationFieldSchema),
  })
  .strict();

/** Video before image: video payloads are a superset; image schema would strip video-only keys. */
const parameterRulesSchema = z.union([
  textRulesSchema,
  videoRulesSchema,
  audioRulesSchema,
  imageRulesSchema,
]);

const patchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  platformEnabled: z.boolean().optional(),
  parameterRules: parameterRulesSchema.optional(),
  brandIcon: z.string().trim().min(1).optional(),
  description: z.string().optional(),
});

const reorderModelsSchema = z.object({
  orderedCanonicalIds: z.array(z.string().min(1)).min(1),
});

adminAiModelsRoutes.get("/", async (c) => {
  const modality = c.req.query("modality");
  const scopedModality =
    modality === "text" ||
    modality === "image" ||
    modality === "video" ||
    modality === "audio"
      ? modality
      : undefined;
  const db = createDatabase(c.env);
  const models = await listPlatformAiModels(db, scopedModality);
  return c.json({ models });
});

adminAiModelsRoutes.put(
  "/reorder",
  zValidator("json", reorderModelsSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const { orderedCanonicalIds } = c.req.valid("json");
    for (let index = 0; index < orderedCanonicalIds.length; index++) {
      const canonicalId = orderedCanonicalIds[index]!;
      await updatePlatformAiModel(db, canonicalId, {
        sortOrder: (index + 1) * 10,
      });
    }
    const modality = c.req.query("modality");
    const scopedModality =
      modality === "text" ||
      modality === "image" ||
      modality === "video" ||
      modality === "audio"
        ? modality
        : undefined;
    const models = await listPlatformAiModels(db, scopedModality);
    return c.json({ models });
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
