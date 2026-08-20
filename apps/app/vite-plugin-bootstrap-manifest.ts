import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import type {
  BootstrapManifest,
  BootstrapPrefetchPack,
  BootstrapStaticAsset,
} from "@dafthunk/types";
import type { OutputBundle, OutputChunk, Plugin } from "vite";

import { LANDING_STATIC_ASSET_PATHS } from "./src/bootstrap/landing-static-assets";
import {
  ALL_PREFETCH_PACK_IDS,
  PREFETCH_PACK_DEFINITIONS,
  ROUTE_TO_PREFETCH_PACKS,
} from "./src/bootstrap/prefetch-pack-definitions";

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

interface ViteManifestChunk {
  readonly file?: string;
  readonly css?: readonly string[];
  readonly imports?: readonly string[];
}

function toAssetPath(fileName: string): string {
  const normalized = fileName.replace(/^\/+/, "");
  if (normalized.startsWith("assets/")) {
    return `/${normalized}`;
  }
  return `/assets/${normalized}`;
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

function collectPackAssetPaths(
  manifest: Record<string, ViteManifestChunk>,
  moduleIds: readonly string[],
  excluded: ReadonlySet<string>
): string[] {
  const paths = new Set<string>();

  for (const moduleId of moduleIds) {
    const chunk = manifest[moduleId];
    if (!chunk?.file) {
      continue;
    }
    const assetPath = toAssetPath(chunk.file);
    if (!excluded.has(assetPath)) {
      paths.add(assetPath);
    }
    for (const cssFile of chunk.css ?? []) {
      const cssPath = toAssetPath(cssFile);
      if (!excluded.has(cssPath)) {
        paths.add(cssPath);
      }
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

function writeCompressedPack(
  packId: string,
  assetPaths: readonly string[],
  entry: string,
  css: readonly string[],
  assetsDir: string,
  outAssetsDir: string
): BootstrapPrefetchPack {
  if (assetPaths.length === 0) {
    throw new Error(`[bootstrap-manifest] Prefetch pack "${packId}" is empty`);
  }

  const archive = buildShellArchive(assetPaths, entry, css, assetsDir);
  const compressed = gzipSync(archive, { level: 9 });
  const hash = createHash("sha256")
    .update(compressed)
    .digest("hex")
    .slice(0, 16);
  const fileName = `prefetch-${packId}-${hash}.gz`;
  fs.writeFileSync(path.join(outAssetsDir, fileName), compressed);

  return {
    id: packId,
    path: toAssetPath(fileName),
    hash,
    assets: assetPaths,
  };
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

function buildManifestVersion(
  shellHash: string,
  packs: readonly BootstrapPrefetchPack[],
  staticAssets: readonly BootstrapStaticAsset[]
): string {
  const payload = [
    shellHash,
    ...packs.map((pack) => `${pack.id}:${pack.hash}`),
    ...staticAssets.map((asset) => `${asset.path}:${asset.hash}`),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function collectStaticAssets(
  projectRoot: string,
  outDir: string,
  assetPaths: readonly string[]
): BootstrapStaticAsset[] {
  return assetPaths.map((assetPath) => {
    const relative = assetPath.replace(/^\/+/, "");
    const sourcePath = path.join(projectRoot, "public", relative);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        `[bootstrap-manifest] Missing static asset: ${assetPath}`
      );
    }
    const destPath = path.join(outDir, relative);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    const bytes = fs.readFileSync(sourcePath);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    return { path: assetPath, hash };
  });
}

function normalizeModuleKey(moduleId: string): string {
  const normalized = moduleId.replace(/\\/g, "/");
  const srcIndex = normalized.indexOf("/src/");
  if (srcIndex >= 0) {
    return normalized.slice(srcIndex + 1);
  }
  if (normalized.startsWith("src/")) {
    return normalized;
  }
  return normalized;
}

function buildManifestFromBundle(
  bundle: OutputBundle
): Record<string, ViteManifestChunk> {
  const chunks = Object.values(bundle).filter(
    (item): item is OutputChunk => item.type === "chunk"
  );
  const chunkByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const manifest: Record<string, ViteManifestChunk> = {};

  for (const chunk of chunks) {
    const importKeys = new Set<string>();
    for (const importedFileName of [
      ...chunk.imports,
      ...(chunk.dynamicImports ?? []),
    ]) {
      const importedChunk = chunkByFile.get(importedFileName);
      if (!importedChunk?.facadeModuleId) {
        continue;
      }
      importKeys.add(normalizeModuleKey(importedChunk.facadeModuleId));
    }

    const importedCss = chunk.viteMetadata?.importedCss;
    const cssFiles =
      importedCss instanceof Set
        ? [...importedCss]
        : Array.isArray(importedCss)
          ? importedCss
          : [];

    const chunkInfo: ViteManifestChunk = {
      file: chunk.fileName,
      css: cssFiles.map((cssFile) => cssFile.replace(/^\/+/, "")),
      imports: [...importKeys],
    };

    for (const moduleId of chunk.moduleIds ?? []) {
      manifest[normalizeModuleKey(moduleId)] = chunkInfo;
    }
  }

  return manifest;
}

export function bootstrapManifestPlugin(): Plugin {
  let capturedEntry: string | undefined;
  let capturedCss: string[] = [];
  let outDir = path.resolve(process.cwd(), "dist");
  let projectRoot = process.cwd();
  let manifestEmitted = false;

  return {
    name: "bootstrap-manifest",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      projectRoot = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle(_options, bundle) {
      if (manifestEmitted) {
        return;
      }

      const assetsDir = path.join(outDir, "assets");
      if (!fs.existsSync(assetsDir)) {
        return;
      }

      manifestEmitted = true;

      const entry = capturedEntry;
      if (!entry) {
        throw new Error(
          "[bootstrap-manifest] Could not determine JS entry from index.html"
        );
      }

      const viteManifest = buildManifestFromBundle(bundle);

      const shellPaths = collectShellAssetPaths(entry, capturedCss, assetsDir);
      const shellExcluded = new Set<string>(shellPaths);

      const prefetchPacks: BootstrapPrefetchPack[] = [];
      for (const packId of ALL_PREFETCH_PACK_IDS) {
        const packDefinition = PREFETCH_PACK_DEFINITIONS[packId];
        const assetPaths = collectPackAssetPaths(
          viteManifest,
          packDefinition.modules,
          shellExcluded
        );

        if (assetPaths.length === 0) {
          console.warn(
            `[bootstrap-manifest] Skipping empty prefetch pack "${packId}"`
          );
          continue;
        }

        prefetchPacks.push(
          writeCompressedPack(
            packId,
            assetPaths,
            entry,
            capturedCss,
            assetsDir,
            assetsDir
          )
        );
      }

      const { shell, shellHash } = buildShellAsset(
        shellPaths,
        entry,
        capturedCss,
        assetsDir,
        assetsDir
      );

      const staticAssets = collectStaticAssets(
        projectRoot,
        outDir,
        LANDING_STATIC_ASSET_PATHS
      );

      const manifest: BootstrapManifest = {
        version: 1,
        entry,
        css: capturedCss,
        shell,
        shellHash,
        manifestVersion: buildManifestVersion(
          shellHash,
          prefetchPacks,
          staticAssets
        ),
        prefetchPacks,
        staticAssets,
        routeToPacks: ROUTE_TO_PREFETCH_PACKS,
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
          manifestVersion: manifest.manifestVersion,
        });
        const inlineTag = `<script type="application/json" id="z3cz-bootstrap-inline">${inlinePayload}</script>`;
        if (!html.includes('id="z3cz-bootstrap-inline"')) {
          html = html.replace("</head>", `    ${inlineTag}\n  </head>`);
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
