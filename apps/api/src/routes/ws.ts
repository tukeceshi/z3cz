import { Hono } from "hono";

import { jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import { getAgentByName } from "../durable-objects/agent-utils";
import { applyWsMembershipHeaders, requireWorkflowView } from "../middleware/org-permissions";

const wsRoutes = new Hono<ApiContext>();

// WebSocket endpoint for real-time workflow state synchronization
wsRoutes.get("/:workflowId", jwtMiddleware, requireWorkflowView(), async (c) => {
  const jwtPayload = c.var.jwtPayload;
  const userId = jwtPayload?.sub;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const workflowId = c.req.param("workflowId")!;

  const stub = await getAgentByName(c.env.WORKFLOW_AGENT, workflowId);

  const headers = new Headers(c.req.raw.headers);
  headers.set("X-User-Id", userId);
  applyWsMembershipHeaders(headers, jwtPayload);
  const newReq = new Request(c.req.url, {
    method: c.req.method,
    headers,
    body: c.req.raw.body,
  });

  return stub.fetch(newReq);
});

export default wsRoutes;
