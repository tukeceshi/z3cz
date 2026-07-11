import type { ResourceFeatureId } from "@dafthunk/types";
import {
  isPlatformFeatureEnabled,
  mergePlatformFeatureConfig,
} from "@dafthunk/types";
import type { MiddlewareHandler } from "hono";

import type { ApiContext } from "../context";
import { createDatabase, getPublicSiteSettings } from "../db";

export function createRequireFeatureMiddleware(
  featureId: ResourceFeatureId
): MiddlewareHandler<ApiContext> {
  return async (c, next) => {
    const db = createDatabase(c.env);
    const settings = await getPublicSiteSettings(db);
    const featureConfig = mergePlatformFeatureConfig(settings.featureConfig);

    if (!isPlatformFeatureEnabled(featureConfig, featureId)) {
      return c.json({ error: "Feature disabled" }, 403);
    }

    await next();
  };
}
