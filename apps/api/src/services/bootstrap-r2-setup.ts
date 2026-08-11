import type { Bindings } from "../context";
import type { BootstrapSettings } from "@dafthunk/types";
import type { BootstrapR2Credentials } from "./bootstrap-r2-client";
import { ensureBootstrapR2ShellCorsFromEnv } from "./bootstrap-r2-cors";
import {
  isBootstrapR2Configured,
  resolveBootstrapR2SecretAccessKey,
} from "./bootstrap-settings";

export async function ensureBootstrapR2CorsIfConfigured(
  settings: BootstrapSettings,
  env: Bindings
): Promise<{ readonly applied: boolean; readonly origins: readonly string[] }> {
  if (!settings.r2Enabled || !isBootstrapR2Configured(settings)) {
    return { applied: false, origins: [] };
  }

  const secretAccessKey = await resolveBootstrapR2SecretAccessKey(
    settings,
    env
  );
  const credentials: BootstrapR2Credentials = {
    accountId: settings.accountId,
    accessKeyId: settings.accessKeyId,
    secretAccessKey,
    bucketName: settings.bucketName,
  };

  return ensureBootstrapR2ShellCorsFromEnv({
    credentials,
    env,
  });
}

export function formatBootstrapCorsMessage(
  baseMessage: string,
  cors: { readonly applied: boolean; readonly origins: readonly string[] }
): string {
  if (cors.origins.length === 0) {
    return baseMessage;
  }
  if (cors.applied) {
    return `${baseMessage} CORS updated for: ${cors.origins.join(", ")}`;
  }
  return `${baseMessage} CORS already allows: ${cors.origins.join(", ")}`;
}
