import { Hono } from "hono";

import { ApiContext } from "../context";

const health = new Hono<ApiContext>();

health.get("/", async (c) => {
  let storageProvider: string = "unknown";
  try {
    const { createStorageBuckets } = await import("../storage/storage-provider");
    const storage = await createStorageBuckets(c.env as Record<string, string>);
    storageProvider = storage.provider;
  } catch {
    storageProvider = "unavailable";
  }

  return c.json({
    status: "ok",
    version: "1.0.0",
    runtime: c.env.RUNTIME ?? "workers",
    storage: storageProvider,
    timestamp: new Date().toISOString(),
  });
});

export default health;
