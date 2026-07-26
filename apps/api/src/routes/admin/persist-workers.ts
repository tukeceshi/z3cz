import type {
  BootstrapPersistWorkerRequest,
  BootstrapPersistWorkerResponse,
  CreatePersistWorkerRequest,
  CreatePersistWorkerResponse,
  ListPersistWorkersResponse,
  PersistWorker,
  PersistWorkerPoolSettings,
  RedeployPersistWorkerRequest,
  RedeployPersistWorkerResponse,
  UpdatePersistWorkerRequest,
  UpdatePersistWorkerResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  createPersistWorker,
  deletePersistWorker,
  generatePersistWorkerSecret,
  getPersistWorkerById,
  getPersistWorkerPoolSettings,
  hashPersistWorkerSecret,
  listPersistWorkers,
  updatePersistWorker,
  updatePersistWorkerPoolSettings,
} from "../../db";
import {
  bootstrapPersistWorker,
  redeployPersistWorker,
} from "../../services/bootstrap-persist-worker";

const adminPersistWorkerRoutes = new Hono<ApiContext>();

const workerIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

const createWorkerSchema = z.object({
  id: workerIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  maxConcurrentJobs: z.number().int().min(1).max(32).optional(),
});

const updateWorkerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  maxConcurrentJobs: z.number().int().min(1).max(32).optional(),
  rotateSecret: z.boolean().optional(),
});

const poolSettingsSchema = z.object({
  enabled: z.boolean(),
});

const bootstrapWorkerSchema = z.object({
  id: workerIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  host: z.string().trim().min(1).max(255),
  sshPort: z.number().int().min(1).max(65535).optional(),
  sshUsername: z.string().trim().min(1).max(120),
  sshPassword: z.string().min(1).max(256),
  maxConcurrentJobs: z.number().int().min(1).max(32).optional(),
  apiBaseUrl: z.string().trim().url().optional(),
});

const redeployWorkerSchema = z.object({
  sshPassword: z.string().min(1).max(256),
  apiBaseUrl: z.string().trim().url().optional(),
});

adminPersistWorkerRoutes.post(
  "/bootstrap",
  zValidator("json", bootstrapWorkerSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const result = await bootstrapPersistWorker(
        c.env,
        db,
        body as BootstrapPersistWorkerRequest,
        jwtPayload.sub
      );
      return c.json(result satisfies BootstrapPersistWorkerResponse, 201);
    } catch (error) {
      const worker =
        error instanceof Error
          ? (error as Error & { worker?: PersistWorker }).worker
          : undefined;
      const message =
        error instanceof Error ? error.message : "Failed to bootstrap worker";
      console.error("Error bootstrapping persist worker:", error);
      return c.json({ error: message, worker }, worker ? 502 : 400);
    }
  }
);

adminPersistWorkerRoutes.post(
  "/:id/redeploy",
  zValidator("json", redeployWorkerSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const result = await redeployPersistWorker(c.env, db, id, {
        sshPassword: body.sshPassword,
        apiBaseUrl: body.apiBaseUrl,
      });
      return c.json(result satisfies RedeployPersistWorkerResponse);
    } catch (error) {
      const worker =
        error instanceof Error
          ? (error as Error & { worker?: PersistWorker }).worker
          : undefined;
      const message =
        error instanceof Error ? error.message : "Failed to redeploy worker";
      console.error("Error redeploying persist worker:", error);
      const status =
        message === "Persist worker not found"
          ? 404
          : worker
            ? 502
            : 400;
      return c.json({ error: message, worker }, status);
    }
  }
);

adminPersistWorkerRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const [workers, settings] = await Promise.all([
      listPersistWorkers(db),
      getPersistWorkerPoolSettings(db),
    ]);
    return c.json({ workers, settings } satisfies ListPersistWorkersResponse);
  } catch (error) {
    console.error("Error listing persist workers:", error);
    return c.json({ error: "Failed to list persist workers" }, 500);
  }
});

adminPersistWorkerRoutes.put(
  "/settings",
  zValidator("json", poolSettingsSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const settings = await updatePersistWorkerPoolSettings(
        db,
        body.enabled,
        jwtPayload.sub
      );
      return c.json({ settings } satisfies { settings: PersistWorkerPoolSettings });
    } catch (error) {
      console.error("Error updating persist worker pool settings:", error);
      return c.json({ error: "Failed to update pool settings" }, 500);
    }
  }
);

adminPersistWorkerRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const id = c.req.param("id");

  try {
    const worker = await getPersistWorkerById(db, id);
    if (!worker) {
      return c.json({ error: "Persist worker not found" }, 404);
    }
    return c.json({ worker } satisfies { worker: PersistWorker });
  } catch (error) {
    console.error("Error fetching persist worker:", error);
    return c.json({ error: "Failed to fetch persist worker" }, 500);
  }
});

adminPersistWorkerRoutes.post(
  "/",
  zValidator("json", createWorkerSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);
    const secret = generatePersistWorkerSecret();

    try {
      const secretHash = await hashPersistWorkerSecret(secret);
      const worker = await createPersistWorker(
        db,
        {
          ...(body as CreatePersistWorkerRequest),
          id: body.id ?? crypto.randomUUID(),
          secretHash,
        },
        jwtPayload.sub
      );

      return c.json(
        { worker, secret } satisfies CreatePersistWorkerResponse,
        201
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create persist worker";
      console.error("Error creating persist worker:", error);
      return c.json({ error: message }, 400);
    }
  }
);

adminPersistWorkerRoutes.patch(
  "/:id",
  zValidator("json", updateWorkerSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      let secret: string | undefined;
      let secretHash: string | undefined;
      if (body.rotateSecret) {
        secret = generatePersistWorkerSecret();
        secretHash = await hashPersistWorkerSecret(secret);
      }

      const worker = await updatePersistWorker(
        db,
        id,
        {
          ...(body as UpdatePersistWorkerRequest),
          ...(secretHash ? { secretHash } : {}),
        },
        jwtPayload.sub
      );

      return c.json({
        worker,
        ...(secret ? { secret } : {}),
      } satisfies UpdatePersistWorkerResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update persist worker";
      console.error("Error updating persist worker:", error);
      const status = message === "Persist worker not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  }
);

adminPersistWorkerRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    await deletePersistWorker(db, id);
    return c.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete persist worker";
    console.error("Error deleting persist worker:", error);
    const status = message === "Persist worker not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

export default adminPersistWorkerRoutes;
