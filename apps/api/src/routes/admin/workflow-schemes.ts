import type {
  CreateWorkflowSchemeRequest,
  ListWorkflowSchemesResponse,
  UpdateWorkflowSchemeRequest,
  WorkflowRuntime,
  WorkflowScheme,
  WorkflowTrigger,
} from "@dafthunk/types";
import { WORKFLOW_SCHEME_OMNIPOTENT_ID } from "@dafthunk/types";
import {
  ALL_WORKFLOW_RUNTIMES,
  ALL_WORKFLOW_TRIGGERS,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  createWorkflowScheme,
  deleteWorkflowScheme,
  getWorkflowSchemeById,
  listWorkflowSchemes,
  updateWorkflowScheme,
} from "../../db";

const adminWorkflowSchemeRoutes = new Hono<ApiContext>();

const workflowTriggerSchema = z.enum(
  ALL_WORKFLOW_TRIGGERS as unknown as [WorkflowTrigger, ...WorkflowTrigger[]]
);
const workflowRuntimeSchema = z.enum(
  ALL_WORKFLOW_RUNTIMES as unknown as [WorkflowRuntime, ...WorkflowRuntime[]]
);

const nodeRulesSchema = z.object({
  includeTags: z.array(z.string()).optional(),
  includeNodeTypes: z.array(z.string()).optional(),
  excludeNodeTypes: z.array(z.string()).optional(),
  alwaysIncludeNodeTypes: z.array(z.string()).optional(),
});

const createSchemeSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(64).nullable().optional(),
  allowedTriggers: z.array(workflowTriggerSchema).min(1),
  allowedRuntimes: z.array(workflowRuntimeSchema).min(1),
  nodeRules: nodeRulesSchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  enabled: z.boolean().optional(),
});

const updateSchemeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(64).nullable().optional(),
  allowedTriggers: z.array(workflowTriggerSchema).min(1).optional(),
  allowedRuntimes: z.array(workflowRuntimeSchema).min(1).optional(),
  nodeRules: nodeRulesSchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

adminWorkflowSchemeRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const schemes = (await listWorkflowSchemes(db)).filter(
      (scheme) => scheme.id !== WORKFLOW_SCHEME_OMNIPOTENT_ID
    );
    return c.json({ schemes } satisfies ListWorkflowSchemesResponse);
  } catch (error) {
    console.error("Error listing admin workflow schemes:", error);
    return c.json({ error: "Failed to list workflow schemes" }, 500);
  }
});

adminWorkflowSchemeRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const id = c.req.param("id");

  try {
    const scheme = await getWorkflowSchemeById(db, id);
    if (!scheme) {
      return c.json({ error: "Scheme not found" }, 404);
    }
    return c.json({ scheme } satisfies { scheme: WorkflowScheme });
  } catch (error) {
    console.error("Error fetching workflow scheme:", error);
    return c.json({ error: "Failed to fetch workflow scheme" }, 500);
  }
});

adminWorkflowSchemeRoutes.post(
  "/",
  zValidator("json", createSchemeSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const scheme = await createWorkflowScheme(
        db,
        body as CreateWorkflowSchemeRequest,
        jwtPayload.sub
      );
      return c.json({ scheme }, 201);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create workflow scheme";
      console.error("Error creating workflow scheme:", error);
      return c.json({ error: message }, 400);
    }
  }
);

adminWorkflowSchemeRoutes.patch(
  "/:id",
  zValidator("json", updateSchemeSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const scheme = await updateWorkflowScheme(
        db,
        id,
        body as UpdateWorkflowSchemeRequest,
        jwtPayload.sub
      );
      return c.json({ scheme });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update workflow scheme";
      console.error("Error updating workflow scheme:", error);
      const status = message === "Scheme not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  }
);

adminWorkflowSchemeRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    await deleteWorkflowScheme(db, id);
    return c.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete workflow scheme";
    console.error("Error deleting workflow scheme:", error);
    const status = message === "Scheme not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

export default adminWorkflowSchemeRoutes;
