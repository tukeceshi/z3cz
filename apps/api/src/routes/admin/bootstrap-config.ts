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

import {

  ensureBootstrapR2CorsIfConfigured,

  formatBootstrapCorsMessage,

} from "../../services/bootstrap-r2-setup";



const adminBootstrapConfigRoutes = new Hono<ApiContext>();



const optionalSecret = z

  .union([z.string(), z.literal(AUTH_CONFIG_SECRET_MASK)])

  .optional();



const updateBootstrapSettingsSchema = z.object({

  r2Enabled: z.boolean().optional(),

  accountId: z.string().optional(),

  accessKeyId: z.string().optional(),

  secretAccessKey: optionalSecret,

  bucketName: z.string().optional(),

  publicBaseUrl: z.string().optional(),

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

      const settings = await getBootstrapSettingsRow(db);

      const cors = await ensureBootstrapR2CorsIfConfigured(settings, c.env);

      return c.json({

        ...config,

        corsApplied: cors.applied,

        corsOrigins: [...cors.origins],

      });

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



    const cors = await ensureBootstrapR2CorsIfConfigured(settings, c.env);



    return c.json({

      ok: true,

      message: formatBootstrapCorsMessage("R2 connection successful", cors),

    });

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

    const cors = await ensureBootstrapR2CorsIfConfigured(settings, c.env);

    const result = await syncBootstrapShellToR2(settings, c.env);

    const next = markBootstrapSyncResult(settings, result, null);

    await saveBootstrapSettingsState(db, next, jwtPayload.sub);

    return c.json({

      ...result,

      message: formatBootstrapCorsMessage(result.message, cors),

    });

  } catch (error) {

    const message = error instanceof Error ? error.message : "Sync failed";

    const settings = await getBootstrapSettingsRow(db);

    const next = markBootstrapSyncResult(settings, null, message);

    await saveBootstrapSettingsState(db, next, jwtPayload.sub);

    return c.json({ ok: false, message }, 400);

  }

});



export default adminBootstrapConfigRoutes;

