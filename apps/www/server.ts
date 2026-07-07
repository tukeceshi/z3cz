import { createServer } from "node:http";

import { createRequestListener } from "@react-router/node";

const port = Number(process.env.PORT ?? 3100);
const hostname = process.env.HOST ?? "0.0.0.0";

const listener = createRequestListener({
  build: () => import("./build/server/index.js"),
  mode: process.env.NODE_ENV ?? "production",
});

createServer(listener).listen(port, hostname, () => {
  console.log(`[www] Node SSR listening on http://${hostname}:${port}`);
});
