import type { BootstrapConfigResponse } from "@dafthunk/types";
import { Hono } from "hono";

import type { ApiContext } from "../context";
import { createDatabase, getBootstrapSettingsRow } from "../db";
import { getBootstrapManifest } from "../services/bootstrap-asset-store";
import { buildBootstrapShellSources } from "../services/bootstrap-settings";

const bootstrapRoutes = new Hono<ApiContext>();

bootstrapRoutes.get("/config", async (c) => {
  const manifest = getBootstrapManifest();
  const db = createDatabase(c.env);
  const settings = await getBootstrapSettingsRow(db);

  if (!manifest) {
    const response: BootstrapConfigResponse = {
      shellEnabled: settings.shellEnabled,
      multiSourceRaceEnabled: settings.multiSourceRaceEnabled,
      shell: "",
      shellHash: "",
      entry: "",
      css: [],
      manifestVersion: "",
      shellSources: [],
    };
    return c.json(response);
  }

  const response: BootstrapConfigResponse = {
    shellEnabled: settings.shellEnabled,
    multiSourceRaceEnabled: settings.multiSourceRaceEnabled,
    shell: manifest.shell,
    shellHash: manifest.shellHash,
    entry: manifest.entry,
    css: [...manifest.css],
    manifestVersion: manifest.manifestVersion || manifest.shellHash,
    shellSources: buildBootstrapShellSources(manifest.shell, settings),
  };

  return c.json(response);
});

export default bootstrapRoutes;
