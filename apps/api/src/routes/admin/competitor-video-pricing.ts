import type { LibtvComparisonConfig } from "@dafthunk/types";
import { mergeLibtvComparisonConfig } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  getLibtvComparisonConfig,
  updateLibtvComparisonConfig,
} from "../../db";

const adminCompetitorVideoPricingRoutes = new Hono<ApiContext>();

const resolutionRateSchema = z.object({
  withoutReferencePerSec: z.number().positive(),
  withReferencePerSec: z.number().positive().nullable(),
});

const seriesRatesSchema = z.object({
  addReferenceSecondsToOutput: z.boolean(),
  resolutions: z.record(z.string(), resolutionRateSchema),
});

const planSchema = z.object({
  id: z.enum(["standard-monthly", "supreme-monthly"]),
  credits: z.number().positive(),
  priceYuan: z.number().positive(),
});

const configSchema = z.object({
  config: z.object({
    series: z.object({
      "2.0": seriesRatesSchema,
      "2.5": seriesRatesSchema,
    }),
    plans: z.array(planSchema).min(1),
  }),
});

adminCompetitorVideoPricingRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const config: LibtvComparisonConfig = await getLibtvComparisonConfig(db);
    return c.json({ config });
  } catch (error) {
    console.error("Error fetching competitor video pricing:", error);
    return c.json({ error: "Failed to fetch competitor video pricing" }, 500);
  }
});

adminCompetitorVideoPricingRoutes.patch(
  "/",
  zValidator("json", configSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const config = await updateLibtvComparisonConfig(
        db,
        mergeLibtvComparisonConfig(body.config),
        jwtPayload.sub
      );
      return c.json({ config });
    } catch (error) {
      console.error("Error updating competitor video pricing:", error);
      return c.json({ error: "Failed to update competitor video pricing" }, 500);
    }
  }
);

export default adminCompetitorVideoPricingRoutes;
