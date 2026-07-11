import type { ListPublicWorkflowSchemesResponse } from "@dafthunk/types";
import { Hono } from "hono";

import type { ApiContext } from "../context";
import { createDatabase, listEnabledWorkflowSchemes } from "../db";

const workflowSchemeRoutes = new Hono<ApiContext>();

workflowSchemeRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const schemes = await listEnabledWorkflowSchemes(db);
    return c.json({ schemes } satisfies ListPublicWorkflowSchemesResponse);
  } catch (error) {
    console.error("Error listing workflow schemes:", error);
    return c.json({ error: "Failed to list workflow schemes" }, 500);
  }
});

export default workflowSchemeRoutes;
