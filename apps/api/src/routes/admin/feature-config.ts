import type { SiteSettings, UpdateFeatureConfigRequest } from "@dafthunk/types";
import { mergePlatformFeatureConfig } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import { createDatabase, getSiteSettings, updateFeatureConfig } from "../../db";

const adminFeatureConfigRoutes = new Hono<ApiContext>();

const featureNavSchema = z.record(
  z.string(),
  z.object({ enabled: z.boolean() })
);

const featureConfigSchema = z.object({
  featureConfig: z.object({
    nav: featureNavSchema,
    defaultWorkflowSchemeId: z.string().trim().min(1),
  }),
});

adminFeatureConfigRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const settings: SiteSettings = await getSiteSettings(db);
    return c.json({
      featureConfig: mergePlatformFeatureConfig(settings.featureConfig),
    });
  } catch (error) {
    console.error("Error fetching feature config:", error);
    return c.json({ error: "Failed to fetch feature config" }, 500);
  }
});

adminFeatureConfigRoutes.patch(
  "/",
  zValidator("json", featureConfigSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    const input: UpdateFeatureConfigRequest = {
      featureConfig: mergePlatformFeatureConfig(body.featureConfig),
    };

    try {
      const settings = await updateFeatureConfig(db, input, jwtPayload.sub);
      return c.json({
        featureConfig: settings.featureConfig,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update feature config";
      console.error("Error updating feature config:", error);
      return c.json({ error: message }, 400);
    }
  }
);

export default adminFeatureConfigRoutes;
