import type { PublicVideoPriceEstimatesResponse } from "@dafthunk/types";
import { Hono } from "hono";

import { ApiContext } from "../context";
import { createDatabase, getPublicVideoPriceEstimatesFromCache } from "../db";

const videoPriceEstimatesRoutes = new Hono<ApiContext>();

videoPriceEstimatesRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const response: PublicVideoPriceEstimatesResponse =
      await getPublicVideoPriceEstimatesFromCache(db);
    return c.json(response);
  } catch (error) {
    console.error("Error fetching public video price estimates:", error);
    return c.json({ error: "Failed to fetch video price estimates" }, 500);
  }
});

export default videoPriceEstimatesRoutes;
