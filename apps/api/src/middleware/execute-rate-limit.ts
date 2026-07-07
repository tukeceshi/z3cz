import type { Context, Next } from "hono";

import type { ApiContext } from "../context";
import { createNodeRateLimitMiddleware } from "./rate-limit-node";

export function createExecuteRateLimitMiddleware() {
  return async (c: Context<ApiContext>, next: Next) => {
    if (c.env.RUNTIME === "node") {
      return createNodeRateLimitMiddleware("execute")(c, next);
    }

    const { createRateLimitMiddleware } = await import("./rate-limit");
    return createRateLimitMiddleware(c.env.RATE_LIMIT_EXECUTE)(c, next);
  };
}
