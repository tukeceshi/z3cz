import { Hono } from "hono";
import postgres from "postgres";

import { ApiContext } from "../context";
import { readBootPhase } from "../env/api-boot-cache";
import { runtimeVersion } from "../runtime/version";

const health = new Hono<ApiContext>();

health.get("/", async (c) => {
  const phase = readBootPhase() ?? "listening";
  let storageProvider: string = "unknown";
  try {
    const { createStorageBuckets } = await import(
      "../storage/storage-provider"
    );
    const storage = await createStorageBuckets(
      c.env as unknown as Record<string, string>
    );
    storageProvider = storage.provider;
  } catch {
    storageProvider = "unavailable";
  }

  return c.json({
    status: "ok",
    phase,
    version: c.env.APP_VERSION ?? runtimeVersion,
    runtime: c.env.RUNTIME ?? "workers",
    storage: storageProvider,
    timestamp: new Date().toISOString(),
  });
});

// Readiness checks an authenticated query, separately from liveness.
health.get("/ready", async (c) => {
  const url = c.env.HYPERDRIVE?.connectionString ?? c.env.DATABASE_URL;
  if (!url) return c.json({ status: "unavailable" }, 503);
  const client = postgres(url, {
    max: 1,
    prepare: false,
    fetch_types: false,
    connect_timeout: 2,
    connection: { statement_timeout: 2000 },
  });
  try {
    await client`SELECT 1`;
    return c.json({ status: "ok", database: "ready" });
  } catch {
    return c.json({ status: "unavailable", database: "unavailable" }, 503);
  } finally {
    await client.end({ timeout: 1 });
  }
});

export default health;
