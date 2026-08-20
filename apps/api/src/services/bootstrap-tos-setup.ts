import type { BootstrapSettings } from "@dafthunk/types";

import type { Bindings } from "../context";
import type { TosCorsRule } from "../integrations/volcengine/tos-sdk-cors";
import {
  getBucketCors,
  putBucketCors,
} from "../integrations/volcengine/tos-sdk-cors";
import {
  isBootstrapTosConfigured,
  resolveBootstrapTosSecretAccessKey,
} from "./bootstrap-settings";
import { resolveDirectUploadCorsOrigins } from "./ensure-direct-upload-cors";

const SHELL_ACCESS_METHODS = ["GET", "HEAD"] as const;
const SHELL_ACCESS_HEADERS = ["*"] as const;
const SHELL_EXPOSE_HEADERS = ["ETag", "Content-Length"] as const;

function corsAllowsShellAccess(
  rules: readonly TosCorsRule[],
  origins: readonly string[]
): boolean {
  return origins.every((origin) =>
    rules.some(
      (rule) =>
        (rule.allowedOrigins.includes("*") ||
          rule.allowedOrigins.includes(origin)) &&
        rule.allowedMethods.includes("GET") &&
        rule.allowedMethods.includes("HEAD")
    )
  );
}

export async function ensureBootstrapTosCorsIfConfigured(
  settings: BootstrapSettings,
  env: Bindings
): Promise<{ readonly applied: boolean; readonly origins: readonly string[] }> {
  if (!settings.r2Enabled || !isBootstrapTosConfigured(settings)) {
    return { applied: false, origins: [] };
  }

  const origins = resolveDirectUploadCorsOrigins(env);
  if (origins.length === 0) {
    return { applied: false, origins };
  }

  const secretAccessKey = await resolveBootstrapTosSecretAccessKey(
    settings,
    env
  );
  const credentials = {
    accessKeyId: settings.tosAccessKeyId,
    secretAccessKey,
    region: settings.tosRegion,
    bucket: settings.tosBucketName,
  };

  const existing = await getBucketCors(credentials);
  if (corsAllowsShellAccess(existing, origins)) {
    return { applied: false, origins };
  }

  await putBucketCors(credentials, [
    ...existing,
    {
      allowedOrigins: origins,
      allowedMethods: [...SHELL_ACCESS_METHODS],
      allowedHeaders: [...SHELL_ACCESS_HEADERS],
      exposeHeaders: [...SHELL_EXPOSE_HEADERS],
      maxAgeSeconds: 3600,
    },
  ]);

  return { applied: true, origins };
}
