import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

import { bootstrapManifestPlugin } from "./vite-plugin-bootstrap-manifest";
import { handleMaintenanceHomepageRequest } from "./maintenance-page";

const ReactCompilerConfig = {};

const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3102";

const apiProxyConfig = {
  "/api": {
    target: apiProxyTarget,
    changeOrigin: true,
    ws: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/api/, ""),
  },
};

function isBootstrapArchivePath(urlPath: string): boolean {
  return /\/assets\/(?:shell|prefetch)-.+\.gz$/.test(urlPath);
}

function bootstrapArchivePreviewPlugin(): Plugin {
  let outDir = path.resolve(process.cwd(), "dist");

  const serveBootstrapArchive = (
    root: string,
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    const urlPath = req.url?.split("?")[0] ?? "";
    if (req.method !== "GET" || !isBootstrapArchivePath(urlPath)) {
      next();
      return;
    }

    const filePath = path.join(root, urlPath);
    if (!fs.existsSync(filePath)) {
      next();
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    fs.createReadStream(filePath).pipe(res);
  };

  return {
    name: "bootstrap-archive-preview",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        serveBootstrapArchive(outDir, req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        serveBootstrapArchive(outDir, req, res, next);
      });
    },
  };
}

function maintenanceHomepagePlugin(apiTarget: string): Plugin {
  return {
    name: "maintenance-homepage",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleMaintenanceHomepageRequest(req, res, next, apiTarget).catch(
          (error: unknown) => {
            console.error("[vite] maintenance homepage middleware failed:", error);
            next();
          }
        );
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleMaintenanceHomepageRequest(req, res, next, apiTarget).catch(
          (error: unknown) => {
            console.error("[vite] maintenance homepage middleware failed:", error);
            next();
          }
        );
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDockerProd = mode === "docker-prod";

  return {
    build: {
      manifest: true,
      // After "rendering chunks", Vite gzip-compresses every file just to print
      // sizes — skip on small Docker hosts to cut peak heap after transform.
      reportCompressedSize: !isDockerProd,
      sourcemap: false,
      // Lower parallel emit reduces peak RSS during minify on constrained builders.
      ...(isDockerProd
        ? {
            rollupOptions: {
              maxParallelFileOps: 2,
            },
          }
        : {}),
    },
    plugins: [
      tailwindcss(),
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
        },
      }),
      bootstrapManifestPlugin(),
      bootstrapArchivePreviewPlugin(),
      maintenanceHomepagePlugin(apiProxyTarget),
    ],
    server: {
      host: true,
      // Docker Desktop (Windows/macOS) bind mounts often miss inotify events.
      watch: {
        usePolling: process.env.CHOKIDAR_USEPOLLING === "1" || !!process.env.API_PROXY_TARGET,
        interval: 300,
      },
      proxy: {
        ...apiProxyConfig,
        "/api": {
          ...apiProxyConfig["/api"],
          configure: (proxy) => {
            proxy.on(
              "error",
              (error: NodeJS.ErrnoException, _req: IncomingMessage, res) => {
                console.error("[vite] API proxy error:", error.message);
                if (
                  !res ||
                  typeof (res as ServerResponse).writeHead !== "function"
                ) {
                  return;
                }
                const response = res as ServerResponse;
                if (response.writableEnded || response.headersSent) {
                  return;
                }
                response.writeHead(503, { "Content-Type": "application/json" });
                response.end(
                  JSON.stringify({
                    error: "API unavailable",
                    message:
                      "API is starting or unreachable. Wait for [api] Node server listening in docker logs, then retry.",
                  })
                );
              }
            );
          },
        },
      },
    },
    preview: {
      host: true,
      proxy: apiProxyConfig,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "lucide-react/icons": path.resolve(
          __dirname,
          "node_modules/lucide-react/dist/esm/icons"
        ),
      },
    },
    test: {
      environment: "jsdom",
    },
  };
});
