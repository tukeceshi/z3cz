import type { Context } from "hono";
import { cors } from "hono/cors";

import { configuredPublicOrigin } from "../auth/auth-cookie";
import { ApiContext } from "../context";

const requestOriginAllowed = (
  c: Context<ApiContext>,
  origin: string
): string | null => {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
  const requestHost = host?.split(",")[0]?.trim();
  try {
    if (requestHost && new URL(origin).host === requestHost) {
      return origin;
    }
  } catch {
    return null;
  }
  return null;
};

export const corsMiddleware = (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
    return next();
  }

  const configured = configuredPublicOrigin(c.env?.WEB_HOST);
  const isDevelopment =
    (c.env?.CLOUDFLARE_ENV ?? "development") !== "production";

  return cors({
    origin: (origin) => configured ?? requestOriginAllowed(c, origin),
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
