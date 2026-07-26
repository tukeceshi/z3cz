import type { Context } from "hono";

import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

export async function assertOrgCloudStorageConfigured(
  c: Context<ApiContext>,
  organizationId: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const db = createDatabase(c.env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return {
      ok: false,
      response: c.json(
        {
          error: "Cloud storage is not configured",
          code: "cloud_storage_not_configured",
        },
        400
      ),
    };
  }
  return { ok: true };
}
