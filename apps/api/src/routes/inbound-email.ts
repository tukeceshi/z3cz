import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { ApiContext } from "../context";
import { handleIncomingEmail } from "../email";
import { createForwardableEmailMessage } from "../utils/inbound-email-message";

const inboundEmailRoutes = new Hono<ApiContext>();

function isAuthorized(c: {
  env: ApiContext["Bindings"];
  req: { header: (name: string) => string | undefined };
}): boolean {
  const secret = c.env.INBOUND_EMAIL_SECRET?.trim();
  if (!secret) {
    return c.env.CLOUDFLARE_ENV !== "production";
  }

  const authHeader = c.req.header("Authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerSecret = c.req.header("X-Inbound-Email-Secret")?.trim();
  return bearer === secret || headerSecret === secret;
}

/**
 * POST /inbound-email
 *
 * JSON body with raw RFC 822 MIME. Replaces Cloudflare's `email:` handler on Node.
 */
inboundEmailRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      raw: z.string().min(1),
      authenticationResults: z.string().optional(),
    })
  ),
  async (c) => {
    if (c.env.RUNTIME !== "node") {
      return c.json({ error: "Inbound email webhook is only available on Node" }, 404);
    }
    if (!isAuthorized(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { from, to, raw, authenticationResults } = c.req.valid("json");
    const message = createForwardableEmailMessage({
      from,
      to,
      rawBytes: new TextEncoder().encode(raw),
      authenticationResults,
    });

    await handleIncomingEmail(message, c.env, {} as ExecutionContext);
    return c.json({ accepted: true });
  }
);

/**
 * POST /inbound-email/raw
 *
 * Body is raw MIME. Envelope addresses via `X-Envelope-From` / `X-Envelope-To`.
 */
inboundEmailRoutes.post("/raw", async (c) => {
  if (c.env.RUNTIME !== "node") {
    return c.json({ error: "Inbound email webhook is only available on Node" }, 404);
  }
  if (!isAuthorized(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const from = c.req.header("X-Envelope-From")?.trim();
  const to = c.req.header("X-Envelope-To")?.trim();
  if (!from || !to) {
    return c.json(
      { error: "X-Envelope-From and X-Envelope-To headers are required" },
      400
    );
  }

  const rawBytes = new Uint8Array(await c.req.arrayBuffer());
  if (rawBytes.byteLength === 0) {
    return c.json({ error: "Empty message body" }, 400);
  }

  const message = createForwardableEmailMessage({
    from,
    to,
    rawBytes,
    authenticationResults: c.req.header("Authentication-Results") ?? undefined,
  });

  await handleIncomingEmail(message, c.env, {} as ExecutionContext);
  return c.json({ accepted: true });
});

export default inboundEmailRoutes;
