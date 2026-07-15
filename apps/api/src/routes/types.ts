import type { GetNodeTypesResponse, NodeType } from "@dafthunk/types";
import { Hono } from "hono";

import { optionalJwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase, getEnabledWorkflowSchemeById } from "../db";
import { getCloudflareModelNodeTypes } from "../runtime/cloudflare-model-catalog";
import { createCloudflareNodeRegistry } from "../runtime/lazy-node-registry";
import { loadNodeTypesFromJson } from "../runtime/node-types-from-json";
import { omitLegacyAiInterfaceCanvasNodes } from "../utils/node-types";
import { filterNodeTypesForScheme } from "../utils/workflow-scheme";

const typeRoutes = new Hono<ApiContext>();

typeRoutes.get("/", optionalJwtMiddleware, async (c) => {
  try {
    const schemeId = c.req.query("schemeId");

    let nodeTypes: NodeType[];
    if (c.env.RUNTIME === "node") {
      nodeTypes = omitLegacyAiInterfaceCanvasNodes(loadNodeTypesFromJson());
    } else {
      const jwtPayload = c.get("jwtPayload");
      const registry = await createCloudflareNodeRegistry(
        c.env,
        jwtPayload?.developerMode ?? false
      );
      const staticNodeTypes = registry.getNodeTypes();

      let cloudflareNodeTypes: NodeType[] = [];
      try {
        cloudflareNodeTypes = await getCloudflareModelNodeTypes(
          c.env,
          c.executionCtx
        );
      } catch (error) {
        console.warn(
          "[types] Skipping Cloudflare model synthesis:",
          error instanceof Error ? error.message : error
        );
      }

      nodeTypes = omitLegacyAiInterfaceCanvasNodes([
        ...staticNodeTypes,
        ...cloudflareNodeTypes,
      ]);
    }

    if (schemeId) {
      const db = createDatabase(c.env);
      const scheme = await getEnabledWorkflowSchemeById(db, schemeId);
      if (!scheme) {
        return c.json({ error: "Workflow scheme not found" }, 404);
      }
      nodeTypes = filterNodeTypesForScheme(nodeTypes, scheme);
    }

    return c.json({ nodeTypes } satisfies GetNodeTypesResponse);
  } catch (error) {
    console.error("Error getting node types:", error);
    return c.json({ error: "Failed to get node types" }, 500);
  }
});

export default typeRoutes;
