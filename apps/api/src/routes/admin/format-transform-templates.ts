import type {
  CreateFormatTransformTemplateRequest,
  FormatTransformProvider,
  ListFormatTransformTemplatesResponse,
  UpdateFormatTransformTemplateRequest,
} from "@dafthunk/types";
import { FORMAT_TRANSFORM_PROVIDERS, FORWARDING_LOCKED_RESOLUTIONS } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createFormatTransformTemplate,
  createDatabase,
  deleteFormatTransformTemplate,
  getFormatTransformTemplateById,
  listFormatTransformTemplates,
  updateFormatTransformTemplate,
} from "../../db";

const adminFormatTransformTemplateRoutes = new Hono<ApiContext>();

const providerSchema = z.enum(
  FORMAT_TRANSFORM_PROVIDERS as unknown as [
    (typeof FORMAT_TRANSFORM_PROVIDERS)[number],
    ...(typeof FORMAT_TRANSFORM_PROVIDERS)[number][],
  ]
);

const valueTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "string[]",
  "object[]",
]);
const collectModeSchema = z.enum(["first", "all"]);

const upstreamParamSchema = z.object({
  id: z.string().trim().min(1),
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use letters, numbers, and underscores"),
  valueType: valueTypeSchema,
});

const lockedResolutionSchema = z.enum(
  FORWARDING_LOCKED_RESOLUTIONS as unknown as [
    (typeof FORWARDING_LOCKED_RESOLUTIONS)[number],
    ...(typeof FORWARDING_LOCKED_RESOLUTIONS)[number][],
  ]
);

const paramMappingSchema = z
  .object({
    upstreamParamId: z.string().trim().min(1),
    sourcePath: z.string().trim().max(500).optional(),
    collectMode: collectModeSchema.optional(),
    transform: z.enum(["ratio_resolution_to_size"]).optional(),
  })
  .refine(
    (mapping) =>
      mapping.transform === "ratio_resolution_to_size" ||
      Boolean(mapping.sourcePath?.trim()),
    { message: "Mapping requires sourcePath or transform" }
  );

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: providerSchema,
  upstreamParams: z.array(upstreamParamSchema).optional(),
  paramMappings: z.array(paramMappingSchema).optional(),
  lockedResolution: lockedResolutionSchema.nullable().optional(),
  supportsTaskCancel: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  provider: providerSchema.optional(),
  upstreamParams: z.array(upstreamParamSchema).optional(),
  paramMappings: z.array(paramMappingSchema).optional(),
  lockedResolution: lockedResolutionSchema.nullable().optional(),
  supportsTaskCancel: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

adminFormatTransformTemplateRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const templates = await listFormatTransformTemplates(db);
    return c.json({ templates } satisfies ListFormatTransformTemplatesResponse);
  } catch (error) {
    console.error("Failed to list format transform templates:", error);
    return c.json({ error: "Failed to list templates" }, 500);
  }
});

adminFormatTransformTemplateRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const id = c.req.param("id");

  try {
    const template = await getFormatTransformTemplateById(db, id);
    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }
    return c.json({ template });
  } catch (error) {
    console.error("Failed to get format transform template:", error);
    return c.json({ error: "Failed to get template" }, 500);
  }
});

adminFormatTransformTemplateRoutes.post(
  "/",
  zValidator("json", createTemplateSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const input = c.req.valid("json") satisfies CreateFormatTransformTemplateRequest;
    const jwtPayload = c.get("jwtPayload");
    const userId = jwtPayload?.sub;

    try {
      const template = await createFormatTransformTemplate(db, {
        id: crypto.randomUUID(),
        input,
        updatedBy: userId,
      });
      return c.json({ template }, 201);
    } catch (error) {
      console.error("Failed to create format transform template:", error);
      return c.json({ error: "Failed to create template" }, 500);
    }
  }
);

adminFormatTransformTemplateRoutes.patch(
  "/:id",
  zValidator("json", updateTemplateSchema),
  async (c) => {
    const db = createDatabase(c.env);
    const id = c.req.param("id");
    const input = c.req.valid("json") satisfies UpdateFormatTransformTemplateRequest;
    const jwtPayload = c.get("jwtPayload");
    const userId = jwtPayload?.sub;

    try {
      const template = await updateFormatTransformTemplate(db, {
        id,
        input,
        updatedBy: userId,
      });
      if (!template) {
        return c.json({ error: "Template not found" }, 404);
      }
      return c.json({ template });
    } catch (error) {
      console.error("Failed to update format transform template:", error);
      return c.json({ error: "Failed to update template" }, 500);
    }
  }
);

adminFormatTransformTemplateRoutes.delete("/:id", async (c) => {
  const db = createDatabase(c.env);
  const id = c.req.param("id");

  try {
    const deleted = await deleteFormatTransformTemplate(db, id);
    if (!deleted) {
      return c.json({ error: "Template not found" }, 404);
    }
    return c.body(null, 204);
  } catch (error) {
    console.error("Failed to delete format transform template:", error);
    return c.json({ error: "Failed to delete template" }, 500);
  }
});

export default adminFormatTransformTemplateRoutes;
