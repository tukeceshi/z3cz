import type { SiteDomainStatus, UpdateSiteDomainResult } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  normalizeSiteAddress,
  SiteAddressClientError,
  SiteAddressValidationError,
} from "../../services/site-address";

const adminSiteDomainRoutes = new Hono<ApiContext>();

const updateSchema = z.object({
  siteAddress: z.string().max(300),
});

function unavailableStatus(
  reason: SiteDomainStatus["unavailableReason"]
): SiteDomainStatus {
  return {
    available: false,
    siteAddress: null,
    httpOnly: true,
    applyError: null,
    unavailableReason: reason,
  };
}

function hostConfig(
  env: ApiContext["Bindings"]
): { socket: string; token: string } | null {
  const socket = env.SITE_ADDRESS_SOCKET?.trim();
  const token = env.SITE_ADDRESS_TOKEN?.trim();
  if (!socket || !token) {
    return null;
  }
  return { socket, token };
}

async function callHost<T>(
  env: ApiContext["Bindings"],
  method: "GET" | "POST",
  body?: Record<string, string>
): Promise<T> {
  const config = hostConfig(env);
  if (!config) {
    throw new SiteAddressClientError("unavailable", 409, "unavailable");
  }
  const { requestSiteAddress } = await import(
    "../../services/site-address-client-node"
  );
  return requestSiteAddress<T>(
    config.socket,
    config.token,
    method,
    "/v1/site-address",
    body
  );
}

adminSiteDomainRoutes.get("/", async (c) => {
  if (!hostConfig(c.env)) {
    return c.json(unavailableStatus("unsupported"));
  }
  try {
    const remote = await callHost<{
      siteAddress: string | null;
      httpOnly: boolean;
      applyError: string | null;
    }>(c.env, "GET");
    const status: SiteDomainStatus = {
      available: true,
      siteAddress: remote.siteAddress,
      httpOnly: remote.httpOnly,
      applyError: remote.applyError,
      unavailableReason: null,
    };
    return c.json(status);
  } catch (error) {
    console.warn("Site address status failed", error);
    return c.json(unavailableStatus("unreachable"));
  }
});

adminSiteDomainRoutes.post("/", zValidator("json", updateSchema), async (c) => {
  if (!hostConfig(c.env)) {
    return c.json({ error: "unavailable", code: "unavailable" }, 409);
  }
  let siteAddress: string;
  try {
    siteAddress = normalizeSiteAddress(c.req.valid("json").siteAddress);
  } catch (error) {
    if (error instanceof SiteAddressValidationError) {
      return c.json({ error: error.code, code: error.code }, 400);
    }
    throw error;
  }
  try {
    const result = await callHost<UpdateSiteDomainResult>(c.env, "POST", {
      siteAddress,
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof SiteAddressClientError) {
      const code = error.code || "unavailable";
      const status =
        code === "invalid_chars" ||
        code === "local_name" ||
        code === "invalid_domain"
          ? 400
          : 409;
      return c.json({ error: code, code }, status);
    }
    return c.json({ error: "unavailable", code: "unavailable" }, 409);
  }
});

export default adminSiteDomainRoutes;
