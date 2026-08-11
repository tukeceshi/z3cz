import type {
  TextContentConflictResponse,
  TextContentRegisterResponse,
  TextContentStageResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { requireModelCallsAccess } from "../middleware/org-permissions";
import {
  registerTextContentUpload,
  stageTextContentEdits,
  streamTextContentSync,
} from "../services/text-content-service";

const textContentRoutes = new Hono<ApiContext>();

textContentRoutes.use("*", jwtMiddleware);
textContentRoutes.use("*", requireModelCallsAccess());
textContentRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

const textEditOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("append"),
    text: z.string(),
  }),
  z.object({
    op: z.literal("replace"),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string(),
  }),
]);

const registerBodySchema = z.object({
  contentSha256: z.string().min(64).max(64),
  mimeType: z.string().min(1),
  contentLength: z.number().int().positive(),
  workflowId: z.string().min(1).optional(),
  replacesResourceId: z.string().min(1).optional(),
});

const stageBodySchema = z.object({
  resourceId: z.string().min(1),
  baseSha256: z.string().min(64).max(64),
  pendingSha256: z.string().min(64).max(64),
  ops: z.array(textEditOpSchema),
});

textContentRoutes.post(
  "/register",
  zValidator("json", registerBodySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");

    const result = await registerTextContentUpload(c.env, {
      organizationId,
      contentSha256: body.contentSha256,
      mimeType: body.mimeType,
      contentLength: body.contentLength,
      workflowId: body.workflowId,
      replacesResourceId: body.replacesResourceId,
    });

    if (!result) {
      return c.json({ error: "Cloud storage is not configured" }, 400);
    }

    const response: TextContentRegisterResponse = result;
    return c.json(response);
  }
);

textContentRoutes.post(
  "/stage",
  zValidator("json", stageBodySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");

    const result = await stageTextContentEdits(c.env, {
      organizationId,
      request: body,
    });

    if ("conflict" in result) {
      const response: TextContentConflictResponse = {
        conflict: true,
        dbSha256: result.dbSha256,
      };
      return c.json(response, 409);
    }

    const response: TextContentStageResponse = { ok: true };
    return c.json(response);
  }
);

textContentRoutes.get("/sync", async (c) => {
  const organizationId = c.get("organizationId")!;
  const resourceId = c.req.query("resourceId")?.trim();
  const localSha = c.req.query("localSha")?.trim() || undefined;

  if (!resourceId) {
    return c.json({ error: "resourceId is required" }, 400);
  }

  const stream = await streamTextContentSync(c.env, {
    organizationId,
    resourceId,
    localSha,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

export default textContentRoutes;
