import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shimDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, string>} */
const shims = {
  "cloudflare:workflows": path.join(shimDir, "cloudflare-workflows.ts"),
  "cloudflare:workers": path.join(shimDir, "cloudflare-workers.ts"),
  "cloudflare:email": path.join(shimDir, "cloudflare-email.ts"),
};

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(
  request,
  parent,
  isMain,
  options
) {
  const shimPath = shims[request];
  if (shimPath) {
    return shimPath;
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
