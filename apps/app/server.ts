import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const currentDir = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3101;

const vite = await createServer({
  configFile: resolve(currentDir, "vite.config.ts"),
  server: {
    port,
    host: true,
  },
});

await vite.listen();
vite.printUrls();
