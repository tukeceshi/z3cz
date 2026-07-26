import { Hono } from "hono";

import { ApiContext } from "../context";
import { createDatabase, getPublicAuthConfig } from "../db";

const publicAuthConfigRoutes = new Hono<ApiContext>();

publicAuthConfigRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const config = await getPublicAuthConfig(db);
    return c.json(config);
  } catch (error) {
    console.error("Error fetching public auth config:", error);
    return c.json({ error: "Failed to fetch auth config" }, 500);
  }
});

export default publicAuthConfigRoutes;
