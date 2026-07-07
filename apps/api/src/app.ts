import { Hono } from "hono";

import auth from "./auth";
import type { ApiContext } from "./context";
import { corsMiddleware } from "./middleware/cors";
import { createNodeRateLimitMiddleware } from "./middleware/rate-limit-node";
import adminRoutes from "./routes/admin";
import apiKeyRoutes from "./routes/api-keys";
import billingRoutes from "./routes/billing";
import botRoutes from "./routes/bots";
import cloudflareAiRoutes from "./routes/cloudflare-ai";
import cloudflareGatewayRoutes from "./routes/cloudflare-gateway";
import dashboardRoutes from "./routes/dashboard";
import databaseRoutes from "./routes/databases";
import datasetRoutes from "./routes/datasets";
import discordWebhook from "./routes/discord-webhook";
import emailRoutes from "./routes/emails";
import executionRoutes from "./routes/executions";
import feedbackRoutes from "./routes/feedback";
import feedbackFormRoutes from "./routes/feedback-forms";
import formTriggerRoutes from "./routes/form-triggers";
import formRoutes from "./routes/forms";
import health from "./routes/health";
import inboundEmailRoutes from "./routes/inbound-email";
import httpTriggerRoutes from "./routes/http-triggers";
import integrationRoutes from "./routes/integrations";
import invitationRoutes from "./routes/invitations";
import llmsRoutes from "./routes/llms";
import oauthRoutes from "./routes/oauth";
import objectRoutes from "./routes/objects";
import organizationRoutes from "./routes/organizations";
import playgroundRoutes from "./routes/playground";
import profileRoutes from "./routes/profile";
import queuePublishRoutes from "./routes/queue-publish";
import queueRoutes from "./routes/queues";
import replicateRoutes from "./routes/replicate";
import robotsRoutes from "./routes/robots";
import schemaRoutes from "./routes/schemas";
import secretRoutes from "./routes/secrets";
import slackWebhook from "./routes/slack-webhook";
import stripeWebhooks from "./routes/stripe-webhooks";
import telegramWebhook from "./routes/telegram-webhook";
import templateRoutes from "./routes/templates";
import typeRoutes from "./routes/types";
import usageRoutes from "./routes/usage";
import whatsappWebhook from "./routes/whatsapp-webhook";
import workflowRoutes from "./routes/workflows";
import wsRoutes from "./routes/ws";

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
      c.req.path.startsWith("/auth/login") || c.req.path === "/auth/refresh";

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
  if (options.runtime === "node") {
    app.route("/inbound-email", inboundEmailRoutes);
  }
  app.route("/auth", auth);
  app.route("/admin", adminRoutes);
  app.route("/oauth", oauthRoutes);
  app.route("/profile", profileRoutes);
  app.route("/organizations", organizationRoutes);
  app.route("/invitations", invitationRoutes);
  app.route("/robots.txt", robotsRoutes);
  app.route("/llms.txt", llmsRoutes);
  app.route("/stripe/webhooks", stripeWebhooks);
  app.route("/telegram", telegramWebhook);
  app.route("/discord", discordWebhook);
  app.route("/whatsapp", whatsappWebhook);
  app.route("/slack", slackWebhook);
  app.route("/http", httpTriggerRoutes);
  app.route("/queues", queuePublishRoutes);
  app.route("/replicate", replicateRoutes);
  app.route("/cloudflare-ai", cloudflareAiRoutes);
  app.route("/cloudflare-gateway", cloudflareGatewayRoutes);
  app.route("/forms", formRoutes);
  app.route("/form-triggers", formTriggerRoutes);
  app.route("/feedback-forms", feedbackFormRoutes);
  app.route("/templates", templateRoutes);
  app.route("/types", typeRoutes);
  app.route("/:organizationId/api-keys", apiKeyRoutes);
  app.route("/:organizationId/billing", billingRoutes);
  app.route("/:organizationId/dashboard", dashboardRoutes);
  app.route("/:organizationId/databases", databaseRoutes);
  app.route("/:organizationId/datasets", datasetRoutes);
  app.route("/:organizationId/bots", botRoutes);
  app.route("/:organizationId/emails", emailRoutes);
  app.route("/:organizationId/feedback", feedbackRoutes);
  app.route("/:organizationId/executions", executionRoutes);
  app.route("/:organizationId/integrations", integrationRoutes);
  app.route("/:organizationId/queues", queueRoutes);
  app.route("/:organizationId/schemas", schemaRoutes);
  app.route("/:organizationId/secrets", secretRoutes);
  app.route("/:organizationId/workflows", workflowRoutes);
  app.route("/:organizationId/objects", objectRoutes);
  app.route("/:organizationId/playground", playgroundRoutes);
  app.route("/:organizationId/usage", usageRoutes);
  if (options.runtime === "workers") {
    app.route("/:organizationId/ws", wsRoutes);
  }

  return app;
}
