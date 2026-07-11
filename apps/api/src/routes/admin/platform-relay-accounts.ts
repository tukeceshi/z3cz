import type {
  CreatePlatformRelayAccountRequest,
  ListPlatformRelayAccountsResponse,
  PlatformRelayAccount,
  UpdatePlatformRelayAccountRequest,
} from "@dafthunk/types";
import { ALL_RELAY_ACCOUNT_PROVIDERS } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  createPlatformRelayAccount,
  deletePlatformRelayAccount,
  getPlatformRelayAccountById,
  listPlatformRelayAccounts,
  updatePlatformRelayAccount,
} from "../../db";
import {
  encryptSecret,
  PLATFORM_ENCRYPTION_SCOPE,
} from "../../utils/encryption";

const adminPlatformRelayAccountRoutes = new Hono<ApiContext>();

const relayProviderSchema = z.enum(
  ALL_RELAY_ACCOUNT_PROVIDERS as unknown as [
    (typeof ALL_RELAY_ACCOUNT_PROVIDERS)[number],
    ...(typeof ALL_RELAY_ACCOUNT_PROVIDERS)[number][],
  ]
);

const createAccountSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
    .optional(),
  name: z.string().trim().min(1).max(120),
  provider: relayProviderSchema.default("newapi"),
  baseUrl: z.string().trim().url("Base URL must be a valid URL"),
  apiKey: z.string().trim().min(1, "API key is required"),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().trim().url("Base URL must be a valid URL").optional(),
  apiKey: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

adminPlatformRelayAccountRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const accounts = await listPlatformRelayAccounts(db);
    return c.json({ accounts } satisfies ListPlatformRelayAccountsResponse);
  } catch (error) {
    console.error("Error listing platform relay accounts:", error);
    return c.json({ error: "Failed to list relay accounts" }, 500);
  }
});

adminPlatformRelayAccountRoutes.get("/:id", async (c) => {
  const db = createDatabase(c.env);
  const id = c.req.param("id");

  try {
    const account = await getPlatformRelayAccountById(db, id);
    if (!account) {
      return c.json({ error: "Relay account not found" }, 404);
    }
    return c.json({ account } satisfies { account: PlatformRelayAccount });
  } catch (error) {
    console.error("Error fetching platform relay account:", error);
    return c.json({ error: "Failed to fetch relay account" }, 500);
  }
});

adminPlatformRelayAccountRoutes.post(
  "/",
  zValidator("json", createAccountSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const apiKeyEncrypted = await encryptSecret(
        body.apiKey,
        c.env,
        PLATFORM_ENCRYPTION_SCOPE
      );

      const account = await createPlatformRelayAccount(
        db,
        {
          ...(body as CreatePlatformRelayAccountRequest),
          id: body.id ?? crypto.randomUUID(),
          apiKeyEncrypted,
        },
        jwtPayload.sub
      );

      return c.json({ account }, 201);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create relay account";
      console.error("Error creating platform relay account:", error);
      return c.json({ error: message }, 400);
    }
  }
);

adminPlatformRelayAccountRoutes.patch(
  "/:id",
  zValidator("json", updateAccountSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = createDatabase(c.env);

    try {
      const apiKeyEncrypted =
        body.apiKey !== undefined
          ? await encryptSecret(body.apiKey, c.env, PLATFORM_ENCRYPTION_SCOPE)
          : undefined;

      const account = await updatePlatformRelayAccount(
        db,
        id,
        {
          ...(body as UpdatePlatformRelayAccountRequest),
          ...(apiKeyEncrypted ? { apiKeyEncrypted } : {}),
        },
        jwtPayload.sub
      );

      return c.json({ account });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update relay account";
      console.error("Error updating platform relay account:", error);
      const status = message === "Relay account not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  }
);

adminPlatformRelayAccountRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    await deletePlatformRelayAccount(db, id);
    return c.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete relay account";
    console.error("Error deleting platform relay account:", error);
    const status = message === "Relay account not found" ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

export default adminPlatformRelayAccountRoutes;
