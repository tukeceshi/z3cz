import type {
  RegisterMediaResourcesRequest,
  RegisterMediaResourcesResponse,
  ResolveMediaResourcesResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { requireModelCallsAccess } from "../middleware/org-permissions";
import {
  registerMediaResources,
  rekeyMediaResourceCatalogEntry,
  resolveMediaResources,
} from "../services/media-resource-catalog-service";

const resourceRoutes = new Hono<ApiContext>();

resourceRoutes.use("*", jwtMiddleware);
resourceRoutes.use("*", requireModelCallsAccess());
resourceRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

const mediaResourceKindSchema = z.enum(["cloud", "local", "ephemeral"]);

const registerMediaResourceSchema = z
  .object({
    id: z.string().min(1),
    kind: mediaResourceKindSchema,
    mimeType: z.string().min(1),
    storageKey: z.string().min(1).optional(),
    replacesResourceId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "cloud" && !value.storageKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "storageKey is required for cloud resources",
        path: ["storageKey"],
      });
    }
  });

const registerMediaResourcesBodySchema = z.union([
  registerMediaResourceSchema,
  z.object({
    resources: z.array(registerMediaResourceSchema).min(1),
  }),
]);

const resolveMediaResourcesBodySchema = z.object({
  resourceIds: z.array(z.string().min(1)).min(1),
});

const rekeyMediaResourceBodySchema = z
  .object({
    fromResourceId: z.string().min(1),
    toResourceId: z.string().min(1),
    kind: mediaResourceKindSchema,
    mimeType: z.string().min(1),
    storageKey: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "cloud" && !value.storageKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "storageKey is required for cloud resources",
        path: ["storageKey"],
      });
    }
  });

function normalizeRegisterRequest(
  body: z.infer<typeof registerMediaResourcesBodySchema>
): RegisterMediaResourcesRequest {
  if ("resources" in body) {
    return { resources: body.resources };
  }
  return { resources: [body] };
}

resourceRoutes.post("/", zValidator("json", registerMediaResourcesBodySchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = createDatabase(c.env);

  try {
    const request = normalizeRegisterRequest(body);
    const registered = await registerMediaResources(db, {
      organizationId,
      resources: request.resources,
    });
    const response: RegisterMediaResourcesResponse = { registered };
    return c.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register media resources";
    return c.json({ error: message }, 400);
  }
});

resourceRoutes.post(
  "/resolve",
  zValidator("json", resolveMediaResourcesBodySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");

    try {
      const result: ResolveMediaResourcesResponse = await resolveMediaResources(
        c.env,
        {
          organizationId,
          resourceIds: body.resourceIds,
        }
      );
      return c.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resolve media resources";
      return c.json({ error: message }, 400);
    }
  }
);

resourceRoutes.post(
  "/rekey",
  zValidator("json", rekeyMediaResourceBodySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      await rekeyMediaResourceCatalogEntry(db, {
        organizationId,
        request: body,
      });
      return c.json({ ok: true as const });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rekey media resource";
      return c.json({ error: message }, 400);
    }
  }
);

export default resourceRoutes;
