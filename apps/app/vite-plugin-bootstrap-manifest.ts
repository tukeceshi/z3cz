import { createHash } from "node:crypto";

import fs from "node:fs";

import path from "node:path";

import { gzipSync } from "node:zlib";



import type { BootstrapManifest } from "@dafthunk/types";

import type { Plugin } from "vite";



interface ShellFileEntry {

  readonly path: string;

  readonly size: number;

}



interface ShellHeader {

  readonly version: 1;

  readonly entry: string;

  readonly css: readonly string[];

  readonly files: readonly ShellFileEntry[];

}



function toAssetPath(fileName: string): string {

  return `/assets/${fileName}`;

}



function toAssetFileName(assetPath: string): string {

  return assetPath.replace(/^\/assets\//, "");

}



function collectShellAssetPaths(

  entry: string,

  css: readonly string[],

  assetsDir: string

): string[] {

  const paths = new Set<string>([entry, ...css]);



  for (const name of fs.readdirSync(assetsDir)) {

    if (/^en-.*\.js$/i.test(name) || /^zh-.*\.js$/i.test(name)) {

      paths.add(toAssetPath(name));

    }

  }



  return [...paths].sort((left, right) => left.localeCompare(right));

}



function buildShellArchive(

  shellPaths: readonly string[],

  entry: string,

  css: readonly string[],

  assetsDir: string

): Buffer {

  const files: ShellFileEntry[] = [];

  const chunks: Buffer[] = [];



  for (const assetPath of shellPaths) {

    const fileName = toAssetFileName(assetPath);

    const absolutePath = path.join(assetsDir, fileName);

    if (!fs.existsSync(absolutePath)) {

      throw new Error(`[bootstrap-manifest] Missing shell asset: ${assetPath}`);

    }

    const bytes = fs.readFileSync(absolutePath);

    files.push({ path: assetPath, size: bytes.byteLength });

    chunks.push(bytes);

  }



  const header: ShellHeader = {

    version: 1,

    entry,

    css,

    files,

  };

  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");

  const headerLength = Buffer.allocUnsafe(4);

  headerLength.writeUInt32BE(headerBytes.byteLength, 0);



  return Buffer.concat([headerLength, headerBytes, ...chunks]);

}



function buildShellAsset(

  shellPaths: readonly string[],

  entry: string,

  css: readonly string[],

  assetsDir: string,

  outAssetsDir: string

): { shell: string; shellHash: string } {

  const archive = buildShellArchive(shellPaths, entry, css, assetsDir);

  const compressed = gzipSync(archive, { level: 9 });

  const shellHash = createHash("sha256")

    .update(compressed)

    .digest("hex")

    .slice(0, 16);

  const shellFileName = `shell-${shellHash}.gz`;

  fs.writeFileSync(path.join(outAssetsDir, shellFileName), compressed);



  return {

    shell: toAssetPath(shellFileName),

    shellHash,

  };

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



      const shellPaths = collectShellAssetPaths(entry, capturedCss, assetsDir);

      const { shell, shellHash } = buildShellAsset(

        shellPaths,

        entry,

        capturedCss,

        assetsDir,

        assetsDir

      );



      const manifest: BootstrapManifest = {

        version: 1,

        entry,

        css: capturedCss,

        shell,

        shellHash,

        manifestVersion: shellHash,

      };



      fs.writeFileSync(

        path.join(outDir, "bootstrap-manifest.json"),

        `${JSON.stringify(manifest, null, 2)}\n`,

        "utf8"

      );

      const indexPath = path.join(outDir, "index.html");

      if (fs.existsSync(indexPath)) {

        let html = fs.readFileSync(indexPath, "utf8");

        const inlinePayload = JSON.stringify({

          shell,

          shellHash,

          entry,

          css: capturedCss,

          manifestVersion: shellHash,

        });

        const inlineTag = `<script type="application/json" id="z3cz-bootstrap-inline">${inlinePayload}</script>`;

        if (!html.includes('id="z3cz-bootstrap-inline"')) {

          html = html.replace(

            "</head>",

            `    ${inlineTag}\n  </head>`

          );

          fs.writeFileSync(indexPath, html, "utf8");

        }

      }

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

            '    <script src="/bootstrap/launcher.js"></script>\n  </body>'

          );

        }



        if (!next.includes('id="z3cz-launcher"')) {

          next = next.replace(

            "<body>",

            `<body>

    <div id="z3cz-launcher" aria-live="polite">

      <style>

        #z3cz-launcher{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;color:#737373;font:14px/1.4 system-ui,sans-serif;z-index:2147483647;pointer-events:none}

        #z3cz-launcher .panel{text-align:center;padding:24px;max-width:320px;pointer-events:none}

        #z3cz-launcher #z3cz-launcher-retry:not([hidden]){pointer-events:auto}

        #z3cz-launcher .spinner{width:28px;height:28px;border:2px solid #e5e5e5;border-top-color:#737373;border-radius:50%;margin:0 auto 12px;animation:z3cz-spin .8s linear infinite}

        #z3cz-launcher .error{color:#dc2626;margin-top:8px}

        #z3cz-launcher button{margin-top:12px;padding:8px 14px;border:1px solid #d4d4d4;background:#fff;color:#171717;border-radius:6px;cursor:pointer}

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

