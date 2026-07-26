import type { UpdateAuthConfigRequest } from "@dafthunk/types";
import { AUTH_CONFIG_SECRET_MASK } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  getAdminAuthConfig,
  updateAuthConfig,
} from "../../db";

const adminAuthConfigRoutes = new Hono<ApiContext>();

const optionalSecret = z
  .union([z.string(), z.literal(AUTH_CONFIG_SECRET_MASK)])
  .optional();

const updateAuthConfigSchema = z.object({
  email: z
    .object({
      requireVerificationOnRegister: z.boolean().optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
      smtpUser: z.string().optional(),
      smtpPassword: optionalSecret,
      fromAddress: z.union([z.string().email(), z.literal("")]).optional(),
    })
    .optional(),
  github: z
    .object({
      enabled: z.boolean().optional(),
      clientId: z.string().optional(),
      clientSecret: optionalSecret,
    })
    .optional(),
  google: z
    .object({
      enabled: z.boolean().optional(),
      clientId: z.string().optional(),
      clientSecret: optionalSecret,
    })
    .optional(),
});

adminAuthConfigRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const config = await getAdminAuthConfig(db);
    return c.json(config);
  } catch (error) {
    console.error("Error fetching auth config:", error);
    return c.json({ error: "Failed to fetch auth config" }, 500);
  }
});

adminAuthConfigRoutes.patch(
  "/",
  zValidator("json", updateAuthConfigSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);
    const input: UpdateAuthConfigRequest = body;

    try {
      const config = await updateAuthConfig(
        db,
        c.env,
        input,
        jwtPayload.sub
      );
      return c.json(config);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update auth config";
      console.error("Error updating auth config:", error);
      return c.json({ error: message }, 400);
    }
  }
);

export default adminAuthConfigRoutes;
