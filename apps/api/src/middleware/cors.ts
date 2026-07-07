import type { Context } from "hono";
import { cors } from "hono/cors";

import { ApiContext } from "../context";

export const corsMiddleware = (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
    return next();
  }

  const webHost = c.env?.WEB_HOST ?? "http://localhost:3101";
  const isDevelopment = (c.env?.CLOUDFLARE_ENV ?? "development") !== "production";

  return cors({
    origin: webHost,
    allowHeaders: [
      "X-Custom-Header",
      "Authorization",
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      ...(isDevelopment ? [] : ["Upgrade-Insecure-Requests"]),
    ],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS", "PATCH"],
    exposeHeaders: ["Content-Length", "X-Content-Type-Options"],
    maxAge: 600,
    credentials: true,
  })(c, next);
};
