import type {
  AiInterfaceSourceSpec,
  GetAiInterfaceTemplateResponse,
  ListAiInterfaceTemplatesResponse,
} from "@dafthunk/types";
import { AI_INTERFACE_SOURCE_SCHEMA_VERSION } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import { AiInterfaceTemplateStore } from "../../stores/ai-interface-template-store";

const adminAiInterfaceTemplateRoutes = new Hono<ApiContext>();

const sourceSpecSchema = z.object({
  schemaVersion: z.literal(AI_INTERFACE_SOURCE_SCHEMA_VERSION),
  meta: z.object({
    id: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000),
    provider: z.enum(["openai", "deepseek", "doubao_volcano", "custom"]),
    icon: z.string().min(1).max(64),
    tags: z.array(z.string()),
    enabled: z.boolean(),
    isSystem: z.boolean(),
    sortOrder: z.number().int(),
    isDefault: z.boolean().optional(),
  }),
  connection: z.object({
    baseUrl: z.string().url(),
    authType: z.enum(["bearer", "header"]),
    headerName: z.string().optional(),
    authPrefix: z.string().optional(),
    defaultHeaders: z.record(z.string(), z.string()).optional(),
    timeoutMs: z.number().int().positive().optional(),
  }),
  execution: z.object({
    mode: z.literal("sync"),
    sync: z.object({
      method: z.literal("POST"),
      path: z.string().min(1),
      bodyMappings: z.array(z.unknown()),
      responseTextPath: z.string().min(1),
      usagePromptPath: z.string().optional(),
      usageCompletionPath: z.string().optional(),
    }),
  }),
  io: z.object({
    defaultModel: z.string().min(1),
    models: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
      })
    ),
    fields: z.array(z.unknown()),
    outputs: z.array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
      })
    ),
    configInputs: z.array(z.string()),
  }),
});

const saveTemplateSchema = z.object({
  sourceSpec: sourceSpecSchema,
  changeNote: z.string().max(500).optional(),
});

adminAiInterfaceTemplateRoutes.get("/", async (c) => {
  try {
    const store = new AiInterfaceTemplateStore(c.env);
    const templates = await store.listTemplates();
    return c.json({ templates } satisfies ListAiInterfaceTemplatesResponse);
  } catch (error) {
    console.error("Error listing AI interface templates:", error);
    return c.json({ error: "Failed to list templates" }, 500);
  }
});

adminAiInterfaceTemplateRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const store = new AiInterfaceTemplateStore(c.env);
    const template = await store.getTemplateDetail(id);
    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }
    return c.json({ template } satisfies GetAiInterfaceTemplateResponse);
  } catch (error) {
    console.error("Error fetching AI interface template:", error);
    return c.json({ error: "Failed to fetch template" }, 500);
  }
});

adminAiInterfaceTemplateRoutes.put(
  "/:id",
  zValidator("json", saveTemplateSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const body = c.req.valid("json");

    if (body.sourceSpec.meta.id !== id) {
      return c.json({ error: "Template ID in body must match URL" }, 400);
    }

    try {
      const store = new AiInterfaceTemplateStore(c.env);
      const template = await store.saveTemplate({
        source: body.sourceSpec as AiInterfaceSourceSpec,
        updatedBy: jwtPayload.sub,
        changeNote: body.changeNote,
      });
      return c.json({ template });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save template";
      console.error("Error saving AI interface template:", error);
      return c.json({ error: message }, 400);
    }
  }
);

adminAiInterfaceTemplateRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const store = new AiInterfaceTemplateStore(c.env);
    await store.deleteTemplate(id);
    return c.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete template";
    console.error("Error deleting AI interface template:", error);
    const status = message === "Template not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

export default adminAiInterfaceTemplateRoutes;
