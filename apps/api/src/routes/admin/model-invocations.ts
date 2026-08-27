import { Hono } from "hono";

import { ApiContext } from "../../context";
import { createDatabase } from "../../db";
import { listApiInterfaceRequestLogsByInvocationId } from "../../db/api-interface-request-log-queries";
import {
  getAdminAiModelInvocation,
  listAdminAiModelInvocations,
} from "../../db/platform-ai-model-queries";

const adminModelInvocationsRoutes = new Hono<ApiContext>();

adminModelInvocationsRoutes.get("/", async (c) => {
  const limit = Math.min(Math.max(1, Number(c.req.query("limit") ?? "20")), 100);
  const offset = Math.max(0, Number(c.req.query("offset") ?? "0"));
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");
  const tzOffsetRaw = c.req.query("tzOffset");
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const validatedDateFrom =
    dateFrom && dateRegex.test(dateFrom) ? dateFrom : undefined;
  const validatedDateTo =
    dateTo && dateRegex.test(dateTo) ? dateTo : undefined;
  const hasDateFilter =
    validatedDateFrom !== undefined || validatedDateTo !== undefined;
  const tzOffsetMinutes =
    hasDateFilter && tzOffsetRaw !== undefined ? Number(tzOffsetRaw) : undefined;

  const db = createDatabase(c.env);
  const result = await listAdminAiModelInvocations(db, {
    limit,
    offset,
    dateFrom: validatedDateFrom,
    dateTo: validatedDateTo,
    tzOffsetMinutes: Number.isFinite(tzOffsetMinutes)
      ? tzOffsetMinutes
      : undefined,
  });
  return c.json(result);
});

adminModelInvocationsRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const invocationId = c.req.param("id");
  const invocation = await getAdminAiModelInvocation(db, invocationId);
  if (!invocation) {
    return c.json({ error: "Invocation not found" }, 404);
  }
  const apiLogs = await listApiInterfaceRequestLogsByInvocationId(db, {
    invocationId,
  });
  return c.json({ invocation, apiLogs });
});

export default adminModelInvocationsRoutes;
