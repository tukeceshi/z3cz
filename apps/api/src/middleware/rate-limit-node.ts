import { rateLimiter } from "hono-rate-limiter";
import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";

import { JWT_ACCESS_TOKEN_NAME, verifyTokenForRateLimit } from "../auth";
import type { ApiContext } from "../context";

export type RateLimitKind = "default" | "auth" | "execute";

export function createNodeRateLimitMiddleware(
  kind: RateLimitKind
): MiddlewareHandler<ApiContext> {
  const limit = kind === "auth" ? 10 : kind === "execute" ? 100 : 500;
  return rateLimiter<ApiContext>({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    keyGenerator: async (c) => {
      const accessToken = getCookie(c, JWT_ACCESS_TOKEN_NAME);
      if (accessToken) {
        const jwtPayload = await verifyTokenForRateLimit(
          accessToken,
          c.env.JWT_SECRET
        );
        if (jwtPayload?.organization?.id) {
          return `org:${jwtPayload.organization.id}`;
        }
      }

      const authHeader = c.req.header("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        return `api:${authHeader.substring(7)}`;
      }

      return c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "local";
    },
  });
}

export function createNodeRateLimitFactory(): (
  kind: RateLimitKind
) => MiddlewareHandler<ApiContext> {
  return (kind) => createNodeRateLimitMiddleware(kind);
}
