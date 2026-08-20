import type { VideoPriceCompetitor } from "@dafthunk/types";
import {
  createVideoPriceCompetitorId,
  isVideoPriceCompetitorHttpUrl,
  isVideoPricePromoDate,
  isVideoPricePromoNoteCompetitor,
  LIBTV_RATE_MODEL_IDS,
  mergeLibtvComparisonConfig,
  readHomepageVideoScenarios,
  toPublicVideoPriceEstimateModel,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  getVideoPriceCompetitorStore,
  updateHomepageVideoPriceCache,
  updateVideoPriceCompetitorStore,
} from "../../db";
import { listPlatformAiModels } from "../../db/platform-ai-model-queries";

const adminCompetitorVideoPricingRoutes = new Hono<ApiContext>();

const resolutionRateSchema = z.object({
  withoutReferencePerSec: z.number().positive(),
  withReferencePerSec: z.number().positive().nullable(),
});

const seriesRatesSchema = z.object({
  addReferenceSecondsToOutput: z.boolean(),
  independentReferencePrice: z.boolean(),
  resolutions: z.record(z.string(), resolutionRateSchema),
});

const planSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  credits: z.number().positive(),
  priceYuan: z.number().positive(),
  quarterPriceYuan: z.number().positive().nullable().optional(),
  yearPriceYuan: z.number().positive().nullable().optional(),
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

const comparisonConfigSchema = z.object({
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
});

function refineCompetitorLink(
  value: { showUrl: boolean; url: string },
  ctx: z.RefinementCtx
) {
  if (!value.showUrl) {
    return;
  }
  if (!isVideoPriceCompetitorHttpUrl(value.url)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A valid http(s) URL is required",
      path: ["url"],
    });
  }
}

function readCompetitorLink(value: { showUrl: boolean; url: string }): {
  showUrl: boolean;
  url: string;
} {
  return {
    showUrl: value.showUrl,
    url: isVideoPriceCompetitorHttpUrl(value.url) ? value.url.trim() : "",
  };
}

function nextCompetitorLink(
  current: { showUrl: boolean; url: string },
  body: { showUrl?: boolean; url?: string }
): { showUrl: boolean; url: string } | { error: string } {
  const showUrl = body.showUrl ?? current.showUrl;
  const urlRaw = body.url ?? current.url;
  const url = isVideoPriceCompetitorHttpUrl(urlRaw) ? urlRaw.trim() : "";
  if (showUrl && !url) {
    return { error: "A valid http(s) URL is required" };
  }
  return { showUrl, url };
}

const addCompareCompetitorSchema = z
  .object({
    kind: z.literal("compare"),
    name: z.string().trim().min(1),
    config: comparisonConfigSchema,
    showUrl: z.boolean(),
    url: z.string(),
  })
  .superRefine(refineCompetitorLink);

const addPromoNoteCompetitorSchema = z
  .object({
    kind: z.literal("promoNote"),
    name: z.string().trim().min(1),
    text: z.string().trim().min(1),
    showDates: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
    showUrl: z.boolean(),
    url: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.showDates &&
      (!isVideoPricePromoDate(value.startsAt) ||
        !isVideoPricePromoDate(value.endsAt))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Promo note dates are required",
        path: ["startsAt"],
      });
    }
    refineCompetitorLink(value, ctx);
  });

const addCompetitorSchema = z.union([
  addCompareCompetitorSchema,
  addPromoNoteCompetitorSchema,
]);

const updateCompetitorSchema = z.object({
  competitorId: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  config: comparisonConfigSchema.optional(),
  text: z.string().trim().min(1).optional(),
  showDates: z.boolean().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  showUrl: z.boolean().optional(),
  url: z.string().optional(),
});

const deleteCompetitorSchema = z.object({
  competitorId: z.string().trim().min(1),
});

const scenarioParamsSchema = z.object({
  canonicalId: z.string().trim().min(1),
  ratio: z.string().trim().min(1),
  resolution: z.string().trim().min(1),
  durationSec: z.number().positive(),
  gachaCount: z.number().int().positive(),
  referencedClipCount: z.number().int().min(0),
  avgReferenceSec: z.number().int().min(0),
});

const scenarioSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string(),
  sortOrder: z.number().int().min(0),
  params: scenarioParamsSchema,
});

const updateScenariosSchema = z.object({
  scenarios: z.array(scenarioSchema).min(1),
});

adminCompetitorVideoPricingRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const store = await getVideoPriceCompetitorStore(db);
    return c.json({
      competitors: store.competitors,
      scenarios: store.scenarios,
    });
  } catch (error) {
    console.error("Error fetching competitor video pricing:", error);
    return c.json({ error: "Failed to fetch competitor video pricing" }, 500);
  }
});

adminCompetitorVideoPricingRoutes.post("/cache", async (c) => {
  const jwtPayload = c.get("jwtPayload");
  if (!jwtPayload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDatabase(c.env);

  try {
    const [models, store] = await Promise.all([
      listPlatformAiModels(db, "video"),
      getVideoPriceCompetitorStore(db),
    ]);
    const publicModels = models.flatMap((model) => {
      const mapped = toPublicVideoPriceEstimateModel(model);
      return mapped ? [mapped] : [];
    });
    const payload = await updateHomepageVideoPriceCache(
      db,
      {
        models: publicModels,
        competitors: store.competitors,
        scenarios: store.scenarios,
      },
      jwtPayload.sub
    );
    return c.json(payload);
  } catch (error) {
    console.error("Error caching homepage video prices:", error);
    return c.json({ error: "Failed to cache homepage video prices" }, 500);
  }
});

adminCompetitorVideoPricingRoutes.post(
  "/",
  zValidator("json", addCompetitorSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const store = await getVideoPriceCompetitorStore(db);
      const link = readCompetitorLink(body);
      const competitor: VideoPriceCompetitor =
        body.kind === "promoNote"
          ? {
              id: createVideoPriceCompetitorId(),
              name: body.name,
              kind: "promoNote",
              ...link,
              text: body.text,
              showDates: body.showDates,
              startsAt: isVideoPricePromoDate(body.startsAt)
                ? body.startsAt
                : "",
              endsAt: isVideoPricePromoDate(body.endsAt) ? body.endsAt : "",
            }
          : {
              id: createVideoPriceCompetitorId(),
              name: body.name,
              kind: "compare",
              ...link,
              config: mergeLibtvComparisonConfig(body.config),
            };
      await updateVideoPriceCompetitorStore(
        db,
        {
          competitors: [...store.competitors, competitor],
          scenarios: store.scenarios,
        },
        jwtPayload.sub
      );
      return c.json({ competitor });
    } catch (error) {
      console.error("Error adding competitor video pricing:", error);
      return c.json({ error: "Failed to add competitor video pricing" }, 500);
    }
  }
);

adminCompetitorVideoPricingRoutes.patch(
  "/",
  zValidator("json", updateCompetitorSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const store = await getVideoPriceCompetitorStore(db);
      const current = store.competitors.find(
        (entry) => entry.id === body.competitorId
      );
      if (!current) {
        return c.json({ error: "Competitor not found" }, 404);
      }
      const link = nextCompetitorLink(current, body);
      if ("error" in link) {
        return c.json({ error: link.error }, 400);
      }
      let competitor: VideoPriceCompetitor;
      if (isVideoPricePromoNoteCompetitor(current)) {
        const nextName = body.name ?? current.name;
        const nextText = body.text ?? current.text;
        const nextShowDates = body.showDates ?? current.showDates;
        const nextStartsAt = body.startsAt ?? current.startsAt;
        const nextEndsAt = body.endsAt ?? current.endsAt;
        if (
          nextShowDates &&
          (!isVideoPricePromoDate(nextStartsAt) ||
            !isVideoPricePromoDate(nextEndsAt))
        ) {
          return c.json({ error: "Promo note dates are required" }, 400);
        }
        competitor = {
          id: current.id,
          name: nextName,
          kind: "promoNote",
          ...link,
          text: nextText,
          showDates: nextShowDates,
          startsAt: isVideoPricePromoDate(nextStartsAt) ? nextStartsAt : "",
          endsAt: isVideoPricePromoDate(nextEndsAt) ? nextEndsAt : "",
        };
      } else {
        competitor = {
          id: current.id,
          name: body.name ?? current.name,
          kind: "compare",
          ...link,
          config: body.config
            ? mergeLibtvComparisonConfig(body.config)
            : current.config,
        };
      }
      const next = {
        competitors: store.competitors.map((entry) =>
          entry.id === competitor.id ? competitor : entry
        ),
        scenarios: store.scenarios,
      };
      await updateVideoPriceCompetitorStore(db, next, jwtPayload.sub);
      return c.json({ competitor });
    } catch (error) {
      console.error("Error updating competitor video pricing:", error);
      return c.json(
        { error: "Failed to update competitor video pricing" },
        500
      );
    }
  }
);

adminCompetitorVideoPricingRoutes.delete(
  "/",
  zValidator("json", deleteCompetitorSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const store = await getVideoPriceCompetitorStore(db);
      const current = store.competitors.find(
        (entry) => entry.id === body.competitorId
      );
      if (!current) {
        return c.json({ error: "Competitor not found" }, 404);
      }
      await updateVideoPriceCompetitorStore(
        db,
        {
          competitors: store.competitors.filter(
            (entry) => entry.id !== body.competitorId
          ),
          scenarios: store.scenarios,
        },
        jwtPayload.sub
      );
      return c.json({ ok: true as const });
    } catch (error) {
      console.error("Error deleting competitor video pricing:", error);
      return c.json(
        { error: "Failed to delete competitor video pricing" },
        500
      );
    }
  }
);

adminCompetitorVideoPricingRoutes.put(
  "/scenarios",
  zValidator("json", updateScenariosSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const store = await getVideoPriceCompetitorStore(db);
      const scenarios = readHomepageVideoScenarios(body.scenarios);
      if (scenarios.length === 0) {
        return c.json({ error: "At least one scenario is required" }, 400);
      }
      const next = await updateVideoPriceCompetitorStore(
        db,
        {
          competitors: store.competitors,
          scenarios,
        },
        jwtPayload.sub
      );
      return c.json({ scenarios: next.scenarios });
    } catch (error) {
      console.error("Error updating homepage video scenarios:", error);
      return c.json({ error: "Failed to update homepage video scenarios" }, 500);
    }
  }
);

export default adminCompetitorVideoPricingRoutes;
