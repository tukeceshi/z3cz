import type { UpdateBootstrapSettingsRequest } from "@dafthunk/types";
import { AUTH_CONFIG_SECRET_MASK } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  getAdminBootstrapSettings,
  getBootstrapSettingsRow,
  saveBootstrapSettingsState,
  updateBootstrapSettings,
} from "../../db";
import { testBootstrapR2Connection } from "../../services/bootstrap-r2-client";
import {
  isBootstrapR2Configured,
  resolveBootstrapR2SecretAccessKey,
} from "../../services/bootstrap-settings";
import {
  markBootstrapSyncResult,
  syncBootstrapShellToR2,
} from "../../services/bootstrap-sync-service";

const adminBootstrapConfigRoutes = new Hono<ApiContext>();

const optionalSecret = z
  .union([z.string(), z.literal(AUTH_CONFIG_SECRET_MASK)])
  .optional();

const updateBootstrapSettingsSchema = z.object({
  shellEnabled: z.boolean().optional(),
  multiSourceRaceEnabled: z.boolean().optional(),
  r2Enabled: z.boolean().optional(),
  accountId: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: optionalSecret,
  bucketName: z.string().optional(),
  publicBaseUrl: z.string().optional(),
  originBaseUrl: z.string().optional(),
});

adminBootstrapConfigRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const config = await getAdminBootstrapSettings(db);
    return c.json(config);
  } catch (error) {
    console.error("Error fetching bootstrap config:", error);
    return c.json({ error: "Failed to fetch bootstrap config" }, 500);
  }
});

adminBootstrapConfigRoutes.patch(
  "/",
  zValidator("json", updateBootstrapSettingsSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);
    const input: UpdateBootstrapSettingsRequest = body;

    try {
      const config = await updateBootstrapSettings(
        db,
        c.env,
        input,
        jwtPayload.sub
      );
      return c.json(config);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update bootstrap config";
      console.error("Error updating bootstrap config:", error);
      return c.json({ error: message }, 400);
    }
  }
);

adminBootstrapConfigRoutes.post("/test-r2", async (c) => {
  const jwtPayload = c.get("jwtPayload");
  if (!jwtPayload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDatabase(c.env);

  try {
    const settings = await getBootstrapSettingsRow(db);
    if (!isBootstrapR2Configured(settings)) {
      return c.json(
        {
          ok: false,
          message:
            "Complete R2 account ID, access key, secret, bucket, and public base URL first",
        },
        400
      );
    }

    const secretAccessKey = await resolveBootstrapR2SecretAccessKey(
      settings,
      c.env
    );

    await testBootstrapR2Connection({
      accountId: settings.accountId,
      accessKeyId: settings.accessKeyId,
      secretAccessKey,
      bucketName: settings.bucketName,
    });

    return c.json({ ok: true, message: "R2 connection successful" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "R2 connection failed";
    return c.json({ ok: false, message }, 400);
  }
});

adminBootstrapConfigRoutes.post("/sync", async (c) => {
  const jwtPayload = c.get("jwtPayload");
  if (!jwtPayload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDatabase(c.env);

  try {
    const settings = await getBootstrapSettingsRow(db);
    const result = await syncBootstrapShellToR2(settings, c.env);
    const next = markBootstrapSyncResult(settings, result, null);
    await saveBootstrapSettingsState(db, next, jwtPayload.sub);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    const settings = await getBootstrapSettingsRow(db);
    const next = markBootstrapSyncResult(settings, null, message);
    await saveBootstrapSettingsState(db, next, jwtPayload.sub);
    return c.json({ ok: false, message }, 400);
  }
});

export default adminBootstrapConfigRoutes;
