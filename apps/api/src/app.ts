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
  if (options.runtime === "node") {
    app.route(
      "/inbound-email",
      lazyRoute(() => import("./routes/inbound-email"))
    );
  }
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
  app.route("/telegram", lazyRoute(() => import("./routes/telegram-webhook")));
  app.route("/discord", lazyRoute(() => import("./routes/discord-webhook")));
  app.route("/whatsapp", lazyRoute(() => import("./routes/whatsapp-webhook")));
  app.route("/slack", lazyRoute(() => import("./routes/slack-webhook")));
  app.route("/http", lazyRoute(() => import("./routes/http-triggers")));
  app.route("/queues", lazyRoute(() => import("./routes/queue-publish")));
  app.route("/replicate", lazyRoute(() => import("./routes/replicate")));
  app.route(
    "/cloudflare-ai",
    lazyRoute(() => import("./routes/cloudflare-ai"))
  );
  app.route(
    "/cloudflare-gateway",
    lazyRoute(() => import("./routes/cloudflare-gateway"))
  );
  app.route("/forms", lazyRoute(() => import("./routes/forms")));
  app.route("/form-triggers", lazyRoute(() => import("./routes/form-triggers")));
  app.route(
    "/feedback-forms",
    lazyRoute(() => import("./routes/feedback-forms"))
  );
  app.route("/templates", lazyRoute(() => import("./routes/templates")));
  app.route(
    "/workflow-schemes",
    lazyRoute(() => import("./routes/workflow-schemes"))
  );
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
    "/:organizationId/datasets",
    lazyRoute(() => import("./routes/datasets"))
  );
  app.route("/:organizationId/bots", lazyRoute(() => import("./routes/bots")));
  app.route(
    "/:organizationId/emails",
    lazyRoute(() => import("./routes/emails"))
  );
  app.route(
    "/:organizationId/feedback",
    lazyRoute(() => import("./routes/feedback"))
  );
  app.route(
    "/:organizationId/executions",
    lazyRoute(() => import("./routes/executions"))
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
    "/:organizationId/platform-ai",
    lazyRoute(() => import("./routes/platform-ai"))
  );
  app.route(
    "/:organizationId/resources",
    lazyRoute(() => import("./routes/resources"))
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
    "/:organizationId/playground",
    lazyRoute(() => import("./routes/playground"))
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
