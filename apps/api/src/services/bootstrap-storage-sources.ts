import type { BootstrapSettings, BootstrapShellSource } from "@dafthunk/types";

import type { Bindings } from "../context";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import {
  bootstrapR2ObjectName,
  buildBootstrapR2PublicUrl,
} from "./bootstrap-r2-client";
import {
  getBootstrapStorageProvider,
  isBootstrapR2Configured,
  isBootstrapTosConfigured,
  resolveBootstrapTosSecretAccessKey,
} from "./bootstrap-settings";

const TOS_DOWNLOAD_EXPIRES_SECONDS = 3600;

export async function createBootstrapTosClient(
  settings: BootstrapSettings,
  env: Bindings
): Promise<VolcengineTosClient> {
  const secretAccessKey = await resolveBootstrapTosSecretAccessKey(
    settings,
    env
  );
  return new VolcengineTosClient({
    accessKeyId: settings.tosAccessKeyId,
    secretAccessKey,
    region: settings.tosRegion,
    bucket: settings.tosBucketName,
  });
}

export async function buildBootstrapStorageUrlMap(
  assetPaths: readonly string[],
  settings: BootstrapSettings,
  env: Bindings
): Promise<ReadonlyMap<string, BootstrapShellSource>> {
  const uniquePaths = [
    ...new Set(assetPaths.filter((path) => path.length > 0)),
  ];
  if (!settings.r2Enabled || uniquePaths.length === 0) {
    return new Map();
  }

  if (
    getBootstrapStorageProvider(settings) === "r2" &&
    isBootstrapR2Configured(settings)
  ) {
    return new Map(
      uniquePaths.map((assetPath) => [
        assetPath,
        {
          url: buildBootstrapR2PublicUrl(settings.publicBaseUrl, assetPath),
          kind: "r2" as const,
        },
      ])
    );
  }

  if (
    getBootstrapStorageProvider(settings) !== "tos" ||
    !isBootstrapTosConfigured(settings)
  ) {
    return new Map();
  }

  const client = await createBootstrapTosClient(settings, env);
  const entries = await Promise.all(
    uniquePaths.map(async (assetPath) => {
      const url = await client.presignGetObjectUrl({
        key: bootstrapR2ObjectName(assetPath),
        expiresInSeconds: TOS_DOWNLOAD_EXPIRES_SECONDS,
      });
      const source: BootstrapShellSource = { url, kind: "tos" };
      return [assetPath, source] as const;
    })
  );

  return new Map(entries);
}
