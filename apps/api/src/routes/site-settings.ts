import type { PublicSiteSettings } from "@dafthunk/types";
import { Hono } from "hono";

import { ApiContext } from "../context";
import { createDatabase, getPublicSiteSettings } from "../db";

const siteSettingsRoutes = new Hono<ApiContext>();

siteSettingsRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const settings: PublicSiteSettings = await getPublicSiteSettings(db);
    return c.json(settings);
  } catch (error) {
    console.error("Error fetching public site settings:", error);
    return c.json({ error: "Failed to fetch site settings" }, 500);
  }
});

export default siteSettingsRoutes;
