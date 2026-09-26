import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const stage = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "dist/release");
const forbidden = new Set(["typescript", "tsx", "esbuild", "drizzle-kit", "vite", "vitest", "wrangler", "@biomejs/biome", "rolldown", "rollup", "lightningcss", "@cloudflare/workers-types"]);
const pkg = JSON.parse(fs.readFileSync(path.join(stage, "api/package.json"), "utf8"));
if (fs.readFileSync(path.join(stage, "password-mount.version"), "utf8").trim() !== "1") {
  throw new Error("Unsupported password mount contract");
}
for (const file of ["caddy/Caddyfile", "scripts/common.sh", "scripts/install.sh", "scripts/update.sh", "scripts/rollback.sh", "scripts/site-address-server.mjs"]) {
  if (!fs.statSync(path.join(stage, file)).isFile()) throw new Error(`Release requires a regular file: ${file}`);
}
if (fs.readFileSync(path.join(stage, "Caddyfile"), "utf8") !== fs.readFileSync(path.join(stage, "caddy/Caddyfile"), "utf8")) {
  throw new Error("Legacy and directory-mounted Caddy configurations must match");
}
for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (forbidden.has(name) || name.startsWith("@dafthunk/")) throw new Error(`Forbidden production dependency: ${name}`);
}
const lock = fs.readFileSync(path.join(stage, "api/pnpm-lock.yaml"), "utf8");
for (const name of forbidden) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^  ['\"]?${escaped}@`, "m").test(lock)) {
    throw new Error(`Forbidden package is present in production lockfile: ${name}`);
  }
}
for (const required of ["api/dist/server.mjs", "api/dist/migrate.mjs", "api/pnpm-lock.yaml", "app/index.html", "compose.yml", "Caddyfile", "VERSION", "CHANGELOG.md", "update-policy.json", "scripts/install-update-runner.sh", "dist/z3cz-host-updater-linux-amd64", "dist/z3cz-host-updater-linux-arm64"]) {
  if (!fs.existsSync(path.join(stage, required))) throw new Error(`Release is missing ${required}`);
}
for (const forbiddenPath of [".git", "apps", "packages", "node_modules", "Dockerfile"] ) {
  if (fs.existsSync(path.join(stage, forbiddenPath))) throw new Error(`Release contains forbidden path: ${forbiddenPath}`);
}
console.log("Release contents and production dependencies verified");
