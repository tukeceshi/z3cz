import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { BootstrapManifest, BootstrapManifestFile } from "@dafthunk/types";
import type { Plugin } from "vite";

function toAssetPath(fileName: string): string {
  return `/assets/${fileName}`;
}

function computeManifestVersion(files: BootstrapManifestFile[]): string {
  const payload = files
    .map((file) => `${file.path}:${file.size}`)
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function isWsViaProxy(): boolean {
  const flag = process.env.VITE_WS_VIA_PROXY;
  return flag === "1" || flag === "true";
}

function buildBootstrapWsConfigScript(): string {
  const payload = JSON.stringify({
    viaProxy: isWsViaProxy(),
    wsHost: process.env.VITE_WS_HOST ?? "",
    apiBase: process.env.VITE_API_HOST ?? "/api",
  });
  return `<script>window.__Z3CZ_WS__=${payload};</script>`;
}

export function bootstrapManifestPlugin(): Plugin {
  let capturedEntry: string | undefined;
  let capturedCss: string[] = [];

  return {
    name: "bootstrap-manifest",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(process.cwd(), "dist");
      const assetsDir = path.join(outDir, "assets");
      if (!fs.existsSync(assetsDir)) {
        throw new Error("[bootstrap-manifest] dist/assets missing after build");
      }

      const entry = capturedEntry;
      if (!entry) {
        throw new Error(
          "[bootstrap-manifest] Could not determine JS entry from index.html"
        );
      }

      const files: BootstrapManifestFile[] = fs
        .readdirSync(assetsDir)
        .filter((name) => name.endsWith(".js"))
        .map((name) => {
          const stats = fs.statSync(path.join(assetsDir, name));
          return {
            path: toAssetPath(name),
            size: stats.size,
          };
        })
        .sort((left, right) => left.path.localeCompare(right.path));

      const manifest: BootstrapManifest = {
        version: 1,
        entry,
        css: capturedCss,
        files,
        manifestVersion: computeManifestVersion(files),
      };

      fs.writeFileSync(
        path.join(outDir, "bootstrap-manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8"
      );
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const scriptMatch = html.match(
          /<script[^>]+src="(\/assets\/[^"]+\.js)"[^>]*><\/script>/i
        );
        if (scriptMatch) {
          capturedEntry = scriptMatch[1];
        }
        capturedCss = [
          ...html.matchAll(/<link[^>]+href="(\/assets\/[^"]+\.css)"[^>]*>/gi),
        ].map((match) => match[1]);

        let next = html.replace(
          /<link rel="preconnect" href="https:\/\/rsms\.me" \/>[\s\S]*?<link rel="stylesheet" href="https:\/\/rsms\.me\/inter\/inter\.css" \/>[\s\n]*/i,
          ""
        );

        next = next.replace(
          /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>\s*/i,
          ""
        );
        next = next.replace(
          /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">\s*/i,
          ""
        );

        if (!next.includes("/bootstrap/launcher.js")) {
          next = next.replace(
            "</body>",
            `    ${buildBootstrapWsConfigScript()}\n    <script src="/bootstrap/launcher.js"></script>\n  </body>`
          );
        }

        if (!next.includes('id="z3cz-launcher"')) {
          next = next.replace(
            "<body>",
            `<body>
    <div id="z3cz-launcher" aria-live="polite">
      <style>
        #z3cz-launcher{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font:14px/1.4 system-ui,sans-serif;z-index:2147483647}
        #z3cz-launcher .panel{text-align:center;padding:24px;max-width:320px}
        #z3cz-launcher .spinner{width:28px;height:28px;border:2px solid #404040;border-top-color:#e5e5e5;border-radius:50%;margin:0 auto 12px;animation:z3cz-spin .8s linear infinite}
        #z3cz-launcher .error{color:#fca5a5;margin-top:8px}
        #z3cz-launcher button{margin-top:12px;padding:8px 14px;border:1px solid #525252;background:#171717;color:#e5e5e5;border-radius:6px;cursor:pointer}
        @keyframes z3cz-spin{to{transform:rotate(360deg)}}
      </style>
      <div class="panel">
        <div class="spinner" aria-hidden="true"></div>
        <div id="z3cz-launcher-status">Loading…</div>
        <div id="z3cz-launcher-error" class="error" hidden></div>
        <button id="z3cz-launcher-retry" type="button" hidden>Retry</button>
      </div>
    </div>`
          );
        }

        return next;
      },
    },
  };
}
