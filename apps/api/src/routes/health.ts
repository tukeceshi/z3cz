import { Hono } from "hono";

import { ApiContext } from "../context";
import { readBootPhase } from "../env/api-boot-cache";

const health = new Hono<ApiContext>();

health.get("/", async (c) => {
  const phase = readBootPhase() ?? "listening";
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
    phase,
    version: "1.0.0",
    runtime: c.env.RUNTIME ?? "workers",
    storage: storageProvider,
    timestamp: new Date().toISOString(),
  });
});

export default health;
