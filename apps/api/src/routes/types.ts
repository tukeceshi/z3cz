import type { GetNodeTypesResponse } from "@dafthunk/types";
import { Hono } from "hono";

import { optionalJwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase, getEnabledWorkflowSchemeById } from "../db";
import { getAllNodeTypes } from "../utils/node-types";
import { filterNodeTypesForScheme } from "../utils/workflow-scheme";

const typeRoutes = new Hono<ApiContext>();

typeRoutes.get("/", optionalJwtMiddleware, async (c) => {
  try {
    const schemeId = c.req.query("schemeId");
    const jwtPayload = c.get("jwtPayload");
    const developerMode = jwtPayload?.developerMode ?? false;

    let nodeTypes = await getAllNodeTypes(
      c.env,
      c.executionCtx,
      developerMode
    );

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
