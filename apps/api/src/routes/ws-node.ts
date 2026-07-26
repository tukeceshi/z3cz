import type { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";

import { wsUpgradeAuthMiddleware } from "../auth";
import type { ApiContext } from "../context";
import {
  membershipFromJwtPayload,
  requireWorkflowView,
} from "../middleware/org-permissions";
import { nodeWorkflowSessionHub } from "../runtime/node-workflow-session-hub";

type UpgradeWebSocket = ReturnType<
  typeof createNodeWebSocket
>["upgradeWebSocket"];

export function registerNodeWsRoutes(
  app: Hono<ApiContext>,
  upgradeWebSocket: UpgradeWebSocket
): void {
  app.get(
    "/:organizationId/ws/:workflowId",
    wsUpgradeAuthMiddleware,
    requireWorkflowView(),
    upgradeWebSocket((c) => {
      const jwtPayload = c.var.jwtPayload;
      const userId = jwtPayload?.sub;
      const workflowId = c.req.param("workflowId");
      const membership = membershipFromJwtPayload(jwtPayload);

      if (!userId || !workflowId || !membership) {
        return {
          onOpen(_event, ws) {
            ws.close(1008, "Unauthorized");
          },
        };
      }

      const env = c.env;

      return {
        onOpen(_event, ws) {
          void nodeWorkflowSessionHub
            .handleOpen(workflowId, userId, env, ws, membership)
            .catch((error) => {
              console.error("[NodeWS] open failed:", error);
              ws.close(1008, "Failed to load workflow state");
            });
        },
        onMessage(event, ws) {
          void nodeWorkflowSessionHub
            .handleMessage(workflowId, userId, env, ws, event.data, membership)
            .catch((error) => {
              console.error("[NodeWS] message failed:", error);
              ws.close(1011, "Message processing failed");
            });
        },
        onClose(_event, ws) {
          nodeWorkflowSessionHub.handleClose(workflowId, ws);
        },
      };
    })
  );
}
