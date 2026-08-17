import type { LibtvComparisonConfig } from "@dafthunk/types";
import { LIBTV_RATE_MODEL_IDS, mergeLibtvComparisonConfig } from "@dafthunk/types";
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
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  credits: z.number().positive(),
  priceYuan: z.number().positive(),
});

const promoSchema = z.object({
  id: z.string().trim().min(1),
  canonicalId: z.enum(
    LIBTV_RATE_MODEL_IDS as unknown as [
      (typeof LIBTV_RATE_MODEL_IDS)[number],
      ...(typeof LIBTV_RATE_MODEL_IDS)[number][],
    ]
  ),
  resolution: z.string().min(1),
  withReference: z.boolean(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  discountFold: z.number().positive().max(10),
});

const configSchema = z.object({
  config: z.object({
    series: z.object({
      "doubao-seedance-2": seriesRatesSchema,
      "doubao-seedance-2-fast": seriesRatesSchema,
      "doubao-seedance-2-mini": seriesRatesSchema,
      "doubao-seedance-2-5": seriesRatesSchema,
    }),
    plans: z
      .array(planSchema)
      .min(1)
      .refine(
        (plans) => new Set(plans.map((plan) => plan.id)).size === plans.length,
        { message: "Plan ids must be unique" }
      ),
    promos: z.array(promoSchema).optional(),
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
      return c.json(
        { error: "Failed to update competitor video pricing" },
        500
      );
    }
  }
);

export default adminCompetitorVideoPricingRoutes;
