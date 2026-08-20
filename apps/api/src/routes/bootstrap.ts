import type {
  BootstrapConfigResponse,
  BootstrapShellSource,
} from "@dafthunk/types";
import { Hono } from "hono";

import type { ApiContext } from "../context";
import { createDatabase, getBootstrapSettingsRow } from "../db";
import { getBootstrapManifest } from "../services/bootstrap-asset-store";
import { buildBootstrapShellSources } from "../services/bootstrap-settings";
import { buildBootstrapStorageUrlMap } from "../services/bootstrap-storage-sources";

const bootstrapRoutes = new Hono<ApiContext>();

bootstrapRoutes.get("/config", async (c) => {
  const manifest = getBootstrapManifest();
  const db = createDatabase(c.env);
  const settings = await getBootstrapSettingsRow(db);

  if (!manifest) {
    const response: BootstrapConfigResponse = {
      shell: "",
      shellHash: "",
      entry: "",
      css: [],
      manifestVersion: "",
      shellSources: [],
      prefetchPacks: [],
      staticAssets: [],
      routeToPacks: {},
    };
    return c.json(response);
  }

  const currentVersion = manifest.manifestVersion || manifest.shellHash;
  const assetPaths = [
    manifest.shell,
    ...(manifest.prefetchPacks ?? []).map((pack) => pack.path),
    ...(manifest.staticAssets ?? []).map((asset) => asset.path),
  ];

  let storageByPath: ReadonlyMap<string, BootstrapShellSource> = new Map();
  try {
    storageByPath = await buildBootstrapStorageUrlMap(
      assetPaths,
      settings,
      c.env
    );
  } catch (error) {
    console.error("Failed to build bootstrap storage URLs:", error);
  }

  const response: BootstrapConfigResponse = {
    shell: manifest.shell,
    shellHash: manifest.shellHash,
    entry: manifest.entry,
    css: [...manifest.css],
    manifestVersion: currentVersion,
    shellSources: buildBootstrapShellSources(
      manifest.shell,
      settings,
      currentVersion,
      storageByPath
    ),
    prefetchPacks: (manifest.prefetchPacks ?? []).map((pack) => ({
      ...pack,
      assets: [...pack.assets],
      sources: buildBootstrapShellSources(
        pack.path,
        settings,
        currentVersion,
        storageByPath
      ),
    })),
    staticAssets: (manifest.staticAssets ?? []).map((asset) => ({
      ...asset,
      sources: buildBootstrapShellSources(
        asset.path,
        settings,
        currentVersion,
        storageByPath
      ),
    })),
    routeToPacks: manifest.routeToPacks ?? {},
  };

  return c.json(response);
});

export default bootstrapRoutes;
