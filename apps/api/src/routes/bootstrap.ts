import type { BootstrapConfigResponse } from "@dafthunk/types";
import { Hono } from "hono";

import type { ApiContext } from "../context";
import { getBootstrapManifest } from "../services/bootstrap-asset-store";

const bootstrapRoutes = new Hono<ApiContext>();

bootstrapRoutes.get("/config", (c) => {
  const manifest = getBootstrapManifest();

  if (!manifest) {
    const response: BootstrapConfigResponse = {
      shell: "",
      shellHash: "",
      entry: "",
      css: [],
      manifestVersion: "",
    };
    return c.json(response);
  }

  const response: BootstrapConfigResponse = {
    shell: manifest.shell,
    shellHash: manifest.shellHash,
    entry: manifest.entry,
    css: [...manifest.css],
    manifestVersion: manifest.manifestVersion || manifest.shellHash,
  };

  return c.json(response);
});

export default bootstrapRoutes;
