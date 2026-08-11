import type { BootstrapConfigResponse } from "@dafthunk/types";
import { Hono } from "hono";

import type { ApiContext } from "../context";
import { createDatabase, getPublicSiteSettings } from "../db";
import {
  computeManifestVersion,
  getBootstrapManifest,
  getBootstrapPreloadFiles,
} from "../services/bootstrap-asset-store";

const bootstrapRoutes = new Hono<ApiContext>();

bootstrapRoutes.get("/config", async (c) => {
  const db = createDatabase(c.env);
  const settings = await getPublicSiteSettings(db);
  const manifest = getBootstrapManifest();

  if (!manifest) {
    const response: BootstrapConfigResponse = {
      enabled: settings.wsBootstrapEnabled,
      entry: "",
      css: [],
      files: [],
      preloadFiles: [],
      manifestVersion: "",
    };
    return c.json(response);
  }

  const manifestVersion =
    manifest.manifestVersion || computeManifestVersion(manifest);

  const response: BootstrapConfigResponse = {
    enabled: settings.wsBootstrapEnabled,
    entry: manifest.entry,
    css: [...manifest.css],
    files: manifest.files.map((file) => ({
      path: file.path,
      size: file.size,
    })),
    preloadFiles: getBootstrapPreloadFiles(manifest),
    manifestVersion,
  };

  return c.json(response);
});

export default bootstrapRoutes;
