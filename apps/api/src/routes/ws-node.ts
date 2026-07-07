import type { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";

import { wsUpgradeAuthMiddleware } from "../auth";
import type { ApiContext } from "../context";
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
    upgradeWebSocket((c) => {
      const userId = c.var.jwtPayload?.sub;
      const workflowId = c.req.param("workflowId");

      if (!userId || !workflowId) {
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
            .handleOpen(workflowId, userId, env, ws)
            .catch((error) => {
              console.error("[NodeWS] open failed:", error);
              ws.close(1008, "Failed to load workflow state");
            });
        },
        onMessage(event, ws) {
          void nodeWorkflowSessionHub
            .handleMessage(workflowId, userId, env, ws, event.data)
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
