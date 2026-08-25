import { Hono } from "hono";

import auth from "./auth";
import type { ApiContext } from "./context";
import { lazyRoute } from "./lazy-route";
import { corsMiddleware } from "./middleware/cors";
import { createNodeRateLimitMiddleware } from "./middleware/rate-limit-node";
import health from "./routes/health";
import publicAuthConfigRoutes from "./routes/auth-config";
import legalDocumentsRoutes from "./routes/legal-documents";
import siteSettingsRoutes from "./routes/site-settings";
import videoPriceEstimatesRoutes from "./routes/video-price-estimates";

export interface CreateAppOptions {
  runtime: "node" | "workers";
}

export function createApp(options: CreateAppOptions): Hono<ApiContext> {
  const app = new Hono<ApiContext>();

  app.use("*", corsMiddleware);

  app.use("*", async (c, next) => {
    if (c.req.path === "/health") {
      return next();
    }

    if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
      return next();
    }

    const isAuthRoute =
      c.req.path.startsWith("/auth/login") ||
      c.req.path === "/auth/refresh" ||
      c.req.path === "/auth/register" ||
      c.req.path === "/auth/register/send-code" ||
      c.req.path === "/auth/register/sub-account" ||
      c.req.path === "/auth/login/password" ||
      c.req.path === "/auth/clear-session";

    if (options.runtime === "node") {
      return createNodeRateLimitMiddleware(isAuthRoute ? "auth" : "default")(
        c,
        next
      );
    }

    const { createRateLimitMiddleware } = await import(
      "./middleware/rate-limit"
    );
    if (isAuthRoute) {
      return createRateLimitMiddleware(c.env.RATE_LIMIT_AUTH)(c, next);
    }

    return createRateLimitMiddleware(c.env.RATE_LIMIT_DEFAULT)(c, next);
  });

  app.route("/health", health);
  app.route("/auth/config", publicAuthConfigRoutes);
  app.route("/legal-documents", legalDocumentsRoutes);
  app.route("/site-settings", siteSettingsRoutes);
  app.route("/video-price-estimates", videoPriceEstimatesRoutes);
  app.route("/bootstrap", lazyRoute(() => import("./routes/bootstrap")));
  app.route("/auth", auth);
  app.route("/admin", lazyRoute(() => import("./routes/admin")));
  app.route(
    "/internal/persist-workers",
    lazyRoute(() => import("./routes/internal/persist-workers"))
  );
  app.route("/oauth", lazyRoute(() => import("./routes/oauth")));
  app.route("/profile", lazyRoute(() => import("./routes/profile")));
  app.route(
    "/organizations",
    lazyRoute(() => import("./routes/organizations"))
  );
  app.route("/invitations", lazyRoute(() => import("./routes/invitations")));
  app.route("/robots.txt", lazyRoute(() => import("./routes/robots")));
  app.route("/llms.txt", lazyRoute(() => import("./routes/llms")));
  app.route(
    "/stripe/webhooks",
    lazyRoute(() => import("./routes/stripe-webhooks"))
  );
  app.route("/queues", lazyRoute(() => import("./routes/queue-publish")));
  app.route("/forms", lazyRoute(() => import("./routes/forms")));
  app.route(
    "/feedback-forms",
    lazyRoute(() => import("./routes/feedback-forms"))
  );
  app.route("/templates", lazyRoute(() => import("./routes/templates")));
  app.route("/workflow-schemes", lazyRoute(() => import("./routes/workflow-schemes")));
  app.route("/types", lazyRoute(() => import("./routes/types")));
  app.route(
    "/:organizationId/api-keys",
    lazyRoute(() => import("./routes/api-keys"))
  );
  app.route(
    "/:organizationId/billing",
    lazyRoute(() => import("./routes/billing"))
  );
  app.route(
    "/:organizationId/dashboard",
    lazyRoute(() => import("./routes/dashboard"))
  );
  app.route(
    "/:organizationId/databases",
    lazyRoute(() => import("./routes/databases"))
  );
  app.route(
    "/:organizationId/feedback",
    lazyRoute(() => import("./routes/feedback"))
  );
  app.route(
    "/:organizationId/integrations",
    lazyRoute(() => import("./routes/integrations"))
  );
  app.route(
    "/:organizationId/queues",
    lazyRoute(() => import("./routes/queues"))
  );
  app.route(
    "/:organizationId/schemas",
    lazyRoute(() => import("./routes/schemas"))
  );
  app.route(
    "/:organizationId/secrets",
    lazyRoute(() => import("./routes/secrets"))
  );
  app.route(
    "/:organizationId/ai-interfaces",
    lazyRoute(() => import("./routes/ai-interfaces"))
  );
  app.route(
    "/:organizationId/cloud-acceleration",
    lazyRoute(() => import("./routes/cloud-acceleration"))
  );
  app.route(
    "/:organizationId/platform-ai",
    lazyRoute(() => import("./routes/platform-ai"))
  );
  app.route(
    "/:organizationId/resources",
    lazyRoute(() => import("./routes/resources"))
  );
  app.route(
    "/:organizationId/text-content",
    lazyRoute(() => import("./routes/text-content"))
  );
  app.route(
    "/:organizationId/workflows",
    lazyRoute(() => import("./routes/workflows"))
  );
  app.route(
    "/:organizationId/workflow-folders",
    lazyRoute(() => import("./routes/workflow-folders"))
  );
  app.route(
    "/:organizationId/objects",
    lazyRoute(() => import("./routes/objects"))
  );
  app.route(
    "/:organizationId/tools/seedance-video-check",
    lazyRoute(() => import("./routes/tools/seedance-video-check"))
  );
  app.route(
    "/:organizationId/usage",
    lazyRoute(() => import("./routes/usage"))
  );
  if (options.runtime === "workers") {
    app.route(
      "/:organizationId/ws",
      lazyRoute(() => import("./routes/ws"))
    );
  }

  return app;
}
