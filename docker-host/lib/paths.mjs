import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** docker-host/ */
export const dockerHostRoot = path.resolve(here, "..");

/** monorepo root */
export const repoRoot = path.resolve(dockerHostRoot, "..");

export const containersDir = path.join(dockerHostRoot, "containers");
export const sharedDir = path.join(dockerHostRoot, "shared");
export const samplesDir = path.join(dockerHostRoot, "samples");

export const appYmlPath = path.join(containersDir, "app.yml");
export const generatedComposePath = path.join(
  dockerHostRoot,
  "docker-compose.generated.yml"
);
export const generatedCaddyfilePath = path.join(
  dockerHostRoot,
  "Caddyfile.generated"
);
export const generatedEnvPath = path.join(dockerHostRoot, ".env.generated");

export function ensureHostDirs() {
  for (const dir of [
    containersDir,
    sharedDir,
    path.join(sharedDir, "postgres"),
    path.join(sharedDir, "storage"),
    path.join(sharedDir, "caddy"),
    path.join(sharedDir, "caddy", "certs"),
    path.join(sharedDir, "backups"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
