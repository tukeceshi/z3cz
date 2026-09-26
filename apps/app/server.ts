import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const currentDir = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

const vite = await createServer({
  configFile: resolve(currentDir, "vite.config.ts"),
  server: {
    port,
    host: true,
  },
});

// Registered before Vite's HTML fallback.
vite.middlewares.use("/health", (_req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "ok" }));
});

await vite.listen();
vite.printUrls();
