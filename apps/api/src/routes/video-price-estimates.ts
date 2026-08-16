import type { PublicVideoPriceEstimatesResponse } from "@dafthunk/types";
import { toPublicVideoPriceEstimateModel } from "@dafthunk/types";
import { Hono } from "hono";

import { ApiContext } from "../context";
import { createDatabase, getLibtvComparisonConfig } from "../db";
import { listPlatformAiModels } from "../db/platform-ai-model-queries";

const videoPriceEstimatesRoutes = new Hono<ApiContext>();

videoPriceEstimatesRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const [models, libtv] = await Promise.all([
      listPlatformAiModels(db, "video"),
      getLibtvComparisonConfig(db),
    ]);
    const publicModels = models.flatMap((model) => {
      const mapped = toPublicVideoPriceEstimateModel(model);
      return mapped ? [mapped] : [];
    });
    const response: PublicVideoPriceEstimatesResponse = {
      models: publicModels,
      libtv,
    };
    return c.json(response);
  } catch (error) {
    console.error("Error fetching public video price estimates:", error);
    return c.json({ error: "Failed to fetch video price estimates" }, 500);
  }
});

export default videoPriceEstimatesRoutes;
