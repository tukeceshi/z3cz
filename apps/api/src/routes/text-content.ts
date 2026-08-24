import type {
  TextContentConflictResponse,
  TextContentSaveResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { requireModelCallsAccess } from "../middleware/org-permissions";
import {
  isTextContentSaveConflict,
  saveTextContent,
  streamTextContentSync,
} from "../services/text-content-service";

const textContentRoutes = new Hono<ApiContext>();

textContentRoutes.use("*", jwtMiddleware);
textContentRoutes.use("*", requireModelCallsAccess());
textContentRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

const saveBodySchema = z.object({
  text: z.string(),
  mimeType: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  baseSha256: z.string().min(64).max(64).optional(),
});

textContentRoutes.post(
  "/save",
  zValidator("json", saveBodySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");

    const result = await saveTextContent(c.env, {
      organizationId,
      text: body.text,
      mimeType: body.mimeType,
      workflowId: body.workflowId,
      resourceId: body.resourceId,
      baseSha256: body.baseSha256,
    });

    if (!result) {
      return c.json({ error: "Cloud storage is not configured" }, 400);
    }

    if (isTextContentSaveConflict(result)) {
      const response: TextContentConflictResponse = {
        conflict: true,
        dbSha256: result.dbSha256,
      };
      return c.json(response, 409);
    }

    const response: TextContentSaveResponse = result;
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
