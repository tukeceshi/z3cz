import type {
  BootstrapPersistWorkerRequest,
  BootstrapPersistWorkerResponse,
  EnableAlwaysAiInterfaceCloudAccelerationResponse,
  ListAiInterfaceCloudAccelerationResponse,
  ListPersistWorkersResponse,
  PersistWorker,
  PersistWorkerPoolSettings,
  RedeployPersistWorkerResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import {
  createDatabase,
  deletePersistWorker,
  getOrgPersistWorkerPoolSettings,
  listPersistWorkers,
  updateOrgPersistWorkerPoolSettings,
} from "../db";
import { requireAiInterfacesAccess } from "../middleware/org-permissions";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import {
  bootstrapPersistWorker,
  redeployPersistWorker,
} from "../services/bootstrap-persist-worker";
import {
  disableOrgAiInterfaceCloudAcceleration,
  enableOrgAlwaysAiInterfaceCloudAcceleration,
  listOrgAiInterfaceCloudAccelerations,
} from "../services/cloud-acceleration-service";
import {
  persistWorkerBootstrapSchema,
  persistWorkerPoolSettingsSchema,
  persistWorkerRedeploySchema,
} from "./persist-worker-route-schemas";

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

cloudAccelerationRoutes.get("/workers", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);

  try {
    const [workers, settings] = await Promise.all([
      listPersistWorkers(db, organizationId),
      getOrgPersistWorkerPoolSettings(db, organizationId),
    ]);
    return c.json({ workers, settings } satisfies ListPersistWorkersResponse);
  } catch (error) {
    console.error("Error listing organization persist workers:", error);
    return c.json({ error: "Failed to list persist workers" }, 500);
  }
});

cloudAccelerationRoutes.put(
  "/workers/settings",
  zValidator("json", persistWorkerPoolSettingsSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const settings = await updateOrgPersistWorkerPoolSettings(
        db,
        organizationId,
        body.enabled
      );
      return c.json({
        settings,
      } satisfies { settings: PersistWorkerPoolSettings });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update pool settings";
      console.error("Error updating organization persist worker pool:", error);
      const status = message === "Organization not found" ? 404 : 500;
      return c.json({ error: message }, status);
    }
  }
);

cloudAccelerationRoutes.post(
  "/workers/bootstrap",
  zValidator("json", persistWorkerBootstrapSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const result = await bootstrapPersistWorker(
        c.env,
        db,
        body as BootstrapPersistWorkerRequest,
        jwtPayload.sub,
        organizationId
      );
      return c.json(result satisfies BootstrapPersistWorkerResponse, 201);
    } catch (error) {
      const worker =
        error instanceof Error
          ? (error as Error & { worker?: PersistWorker }).worker
          : undefined;
      const message =
        error instanceof Error ? error.message : "Failed to bootstrap worker";
      console.error("Error bootstrapping organization persist worker:", error);
      return c.json({ error: message, worker }, worker ? 502 : 400);
    }
  }
);

cloudAccelerationRoutes.post(
  "/workers/:id/redeploy",
  zValidator("json", persistWorkerRedeploySchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const organizationId = c.get("organizationId")!;
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const result = await redeployPersistWorker(
        c.env,
        db,
        id,
        {
          sshPassword: body.sshPassword,
          apiBaseUrl: body.apiBaseUrl,
        },
        organizationId
      );
      return c.json(result satisfies RedeployPersistWorkerResponse);
    } catch (error) {
      const worker =
        error instanceof Error
          ? (error as Error & { worker?: PersistWorker }).worker
          : undefined;
      const message =
        error instanceof Error ? error.message : "Failed to redeploy worker";
      console.error("Error redeploying organization persist worker:", error);
      const status =
        message === "Persist worker not found" ? 404 : worker ? 502 : 400;
      return c.json({ error: message, worker }, status);
    }
  }
);

cloudAccelerationRoutes.delete("/workers/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    await deletePersistWorker(db, id, organizationId);
    return c.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete persist worker";
    console.error("Error deleting organization persist worker:", error);
    const status = message === "Persist worker not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

export default cloudAccelerationRoutes;
