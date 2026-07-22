#!/usr/bin/env node
/**
 * Preloads the API runtime module graph before tsx watch starts.
 * Used on warm/full Docker restarts; does not start the HTTP server.
 */
const startedAt = Date.now();

console.log("[api:warm] Preloading runtime module graph...");

try {
  await import("../src/runtime/cloudflare-node-registry.ts");
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[api:warm] Runtime preload finished in ${elapsedSec}s.`);
} catch (error) {
  console.error("[api:warm] Runtime preload failed:", error);
  process.exit(1);
}
