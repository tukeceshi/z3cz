import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "../..");
const api = path.join(root, "apps/api");
const { build } = createRequire(path.join(api, "package.json"))("esbuild");
const out = path.join(root, "dist/release/api");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "dist"), { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(api, "package.json"), "utf8"));
const bundledRuntime = new Set([
  "@cloudflare/sandbox",
  "@hono-rate-limiter/cloudflare",
  "agents",
  "partyserver",
]);
const external = Object.keys(pkg.dependencies).filter(
  (name) => !name.startsWith("@dafthunk/") && !bundledRuntime.has(name)
);

await build({
  entryPoints: {
    server: path.join(api, "src/server.ts"),
    migrate: path.join(api, "src/production-migrate.ts"),
  },
  outdir: path.join(out, "dist"),
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  target: "node22",
  packages: "bundle",
  external,
  sourcemap: false,
  minify: false,
  banner: { js: "import { createRequire as __createRequire } from 'node:module';const require=__createRequire(import.meta.url);" },
  plugins: [{
    name: "cloudflare-node-shims",
    setup(builder) {
      const aliases = {
        "cloudflare:workflows": "cloudflare-workflows.ts",
        "cloudflare:workers": "cloudflare-workers.ts",
        "cloudflare:email": "cloudflare-email.ts",
      };
      builder.onResolve({ filter: /^cloudflare:/ }, (args) => ({
        path: path.join(api, "src/shims", aliases[args.path]),
      }));
    },
  }],
});

fs.cpSync(path.join(api, "src/db/migrations"), path.join(out, "migrations"), {
  recursive: true,
});
