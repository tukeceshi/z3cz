import type { SiteSettings, UpdateSiteSettingsRequest } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  getSiteSettings,
  updateSiteSettings,
} from "../../db";

const adminSettingsRoutes = new Hono<ApiContext>();

const updateSiteSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(120).optional(),
  siteTagline: z.string().trim().min(1).max(240).optional(),
  supportEmail: z
    .union([z.string().trim().email(), z.literal(""), z.null()])
    .optional(),
  newUserTourEnabled: z.boolean().optional(),
  wsBootstrapEnabled: z.boolean().optional(),
  maintenanceEnabled: z.boolean().optional(),
  maintenanceMessage: z
    .union([z.string().trim().max(2000), z.literal(""), z.null()])
    .optional(),
});
adminSettingsRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const settings: SiteSettings = await getSiteSettings(db);
    return c.json(settings);
  } catch (error) {
    console.error("Error fetching site settings:", error);
    return c.json({ error: "Failed to fetch site settings" }, 500);
  }
});

adminSettingsRoutes.patch(
  "/",
  zValidator("json", updateSiteSettingsSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    const input: UpdateSiteSettingsRequest = {
      ...(body.siteName !== undefined ? { siteName: body.siteName } : {}),
      ...(body.siteTagline !== undefined ? { siteTagline: body.siteTagline } : {}),
      ...(body.supportEmail !== undefined
        ? {
            supportEmail:
              body.supportEmail === "" ? null : body.supportEmail,
          }
        : {}),
      ...(body.newUserTourEnabled !== undefined
        ? { newUserTourEnabled: body.newUserTourEnabled }
        : {}),
      ...(body.wsBootstrapEnabled !== undefined
        ? { wsBootstrapEnabled: body.wsBootstrapEnabled }
        : {}),
      ...(body.maintenanceEnabled !== undefined
        ? { maintenanceEnabled: body.maintenanceEnabled }
        : {}),
      ...(body.maintenanceMessage !== undefined
        ? {
            maintenanceMessage:
              body.maintenanceMessage === "" ? null : body.maintenanceMessage,
          }
        : {}),
    };

    try {
      const settings = await updateSiteSettings(db, input, jwtPayload.sub);
      return c.json(settings);
    } catch (error) {
      console.error("Error updating site settings:", error);
      return c.json({ error: "Failed to update site settings" }, 500);
    }
  }
);

export default adminSettingsRoutes;
