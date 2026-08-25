import type {
  EnableAlwaysAiInterfaceCloudAccelerationResponse,
  ListAiInterfaceCloudAccelerationResponse,
} from "@dafthunk/types";
import { Hono } from "hono";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import { requireAiInterfacesAccess } from "../middleware/org-permissions";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import {
  disableOrgAiInterfaceCloudAcceleration,
  enableOrgAlwaysAiInterfaceCloudAcceleration,
  listOrgAiInterfaceCloudAccelerations,
} from "../services/cloud-acceleration-service";

const cloudAccelerationRoutes = new Hono<ApiContext>();

cloudAccelerationRoutes.use("*", jwtMiddleware);
cloudAccelerationRoutes.use("*", requireAiInterfacesAccess());
cloudAccelerationRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

cloudAccelerationRoutes.get("/interfaces", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const entries = await listOrgAiInterfaceCloudAccelerations(db, organizationId);
  const response: ListAiInterfaceCloudAccelerationResponse = { entries };
  return c.json(response);
});

cloudAccelerationRoutes.post("/interfaces/:aiInterfaceId/disable", async (c) => {
  const organizationId = c.get("organizationId")!;
  const aiInterfaceId = c.req.param("aiInterfaceId");
  const db = createDatabase(c.env);
  const disabled = await disableOrgAiInterfaceCloudAcceleration(
    db,
    organizationId,
    aiInterfaceId
  );
  if (!disabled) {
    return c.json({ error: "Interface cloud acceleration not found" }, 404);
  }
  return c.json({ success: true });
});

cloudAccelerationRoutes.post(
  "/interfaces/:aiInterfaceId/enable-always",
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const aiInterfaceId = c.req.param("aiInterfaceId");
    const db = createDatabase(c.env);
    const entry = await enableOrgAlwaysAiInterfaceCloudAcceleration(
      db,
      organizationId,
      aiInterfaceId
    );
    if (!entry) {
      return c.json({ error: "AI interface not found" }, 404);
    }
    const response: EnableAlwaysAiInterfaceCloudAccelerationResponse = {
      entry,
    };
    return c.json(response);
  }
);

export default cloudAccelerationRoutes;
