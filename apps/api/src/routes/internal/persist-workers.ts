import type {
  PersistWorkerClaimJobResponse,
  PersistWorkerCompleteJobRequest,
  PersistWorkerFailJobRequest,
  PersistWorkerPresignUploadsResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import { createDatabase } from "../../db";
import { touchPersistWorkerHeartbeat, verifyPersistWorkerSecret } from "../../db/persist-worker-queries";
import {
  claimPersistJobForWorker,
  completePersistJobFromWorker,
  failPersistJobFromWorker,
  presignPersistJobUploadsForWorker,
} from "../../services/persist-worker-pool-service";

const internalPersistWorkerRoutes = new Hono<ApiContext>();

function readWorkerCredentials(c: {
  req: { header: (name: string) => string | undefined };
}): { workerId: string; secret: string } | null {
  const workerId = c.req.header("X-Worker-Id")?.trim();
  const secret = c.req.header("X-Worker-Secret")?.trim();
  if (!workerId || !secret) {
    return null;
  }
  return { workerId, secret };
}

internalPersistWorkerRoutes.post("/heartbeat", async (c) => {
  const credentials = readWorkerCredentials(c);
  if (!credentials) {
    return c.json({ error: "Missing worker credentials" }, 401);
  }

  const db = createDatabase(c.env);
  const worker = await verifyPersistWorkerSecret(
    db,
    credentials.workerId,
    credentials.secret
  );
  if (!worker) {
    return c.json({ error: "Invalid worker credentials" }, 401);
  }

  await touchPersistWorkerHeartbeat(db, credentials.workerId);
  return c.json({ ok: true });
});

internalPersistWorkerRoutes.post("/claim", async (c) => {
  const credentials = readWorkerCredentials(c);
  if (!credentials) {
    return c.json({ error: "Missing worker credentials" }, 401);
  }

  const db = createDatabase(c.env);
  const claimed = await claimPersistJobForWorker(
    db,
    credentials.workerId,
    credentials.secret
  );

  if (!claimed) {
    return c.json({ job: null });
  }

  return c.json({
    job: claimed.job,
    pendingMedia: claimed.pendingMedia,
  } satisfies PersistWorkerClaimJobResponse);
});

const presignSchema = z.object({
  items: z
    .array(
      z.object({
        index: z.number().int().min(0),
        contentLength: z.number().int().positive(),
        mimeType: z.string().trim().min(1),
      })
    )
    .min(1),
});

internalPersistWorkerRoutes.post(
  "/jobs/:jobId/presign-uploads",
  zValidator("json", presignSchema),
  async (c) => {
    const credentials = readWorkerCredentials(c);
    if (!credentials) {
      return c.json({ error: "Missing worker credentials" }, 401);
    }

    const jobId = c.req.param("jobId");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    const slots = await presignPersistJobUploadsForWorker(c.env, db, {
      workerId: credentials.workerId,
      secret: credentials.secret,
      jobId,
      items: body.items,
    });

    if (!slots) {
      return c.json({ error: "Unable to presign uploads" }, 404);
    }

    return c.json({ slots } satisfies PersistWorkerPresignUploadsResponse);
  }
);

const completeSchema = z.object({
  finalMedia: z.array(z.record(z.string(), z.unknown())).min(1),
});

internalPersistWorkerRoutes.post(
  "/jobs/:jobId/complete",
  zValidator("json", completeSchema),
  async (c) => {
    const credentials = readWorkerCredentials(c);
    if (!credentials) {
      return c.json({ error: "Missing worker credentials" }, 401);
    }

    const jobId = c.req.param("jobId");
    const body = c.req.valid("json") as PersistWorkerCompleteJobRequest;
    const db = createDatabase(c.env);

    const job = await completePersistJobFromWorker(c.env, db, {
      workerId: credentials.workerId,
      secret: credentials.secret,
      jobId,
      finalMedia: body.finalMedia,
    });

    if (!job) {
      return c.json({ error: "Unable to complete job" }, 404);
    }

    return c.json({ job });
  }
);

const failSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

internalPersistWorkerRoutes.post(
  "/jobs/:jobId/fail",
  zValidator("json", failSchema),
  async (c) => {
    const credentials = readWorkerCredentials(c);
    if (!credentials) {
      return c.json({ error: "Missing worker credentials" }, 401);
    }

    const jobId = c.req.param("jobId");
    const body = c.req.valid("json") as PersistWorkerFailJobRequest;
    const db = createDatabase(c.env);

    const job = await failPersistJobFromWorker(db, {
      workerId: credentials.workerId,
      secret: credentials.secret,
      jobId,
      reason: body.reason,
    });

    if (!job) {
      return c.json({ error: "Unable to fail job" }, 404);
    }

    return c.json({ job });
  }
);

export default internalPersistWorkerRoutes;
