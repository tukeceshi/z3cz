import { Hono } from "hono";

import { ApiContext } from "../../context";
import { createDatabase } from "../../db";
import {
  getAdminAiModelInvocation,
  listAdminAiModelInvocations,
} from "../../db/platform-ai-model-queries";

const adminModelInvocationsRoutes = new Hono<ApiContext>();

adminModelInvocationsRoutes.get("/", async (c) => {
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const db = createDatabase(c.env);
  const result = await listAdminAiModelInvocations(db, { limit, offset });
  return c.json(result);
});

adminModelInvocationsRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const invocation = await getAdminAiModelInvocation(db, c.req.param("id"));
  if (!invocation) {
    return c.json({ error: "Invocation not found" }, 404);
  }
  return c.json({ invocation });
});

export default adminModelInvocationsRoutes;
