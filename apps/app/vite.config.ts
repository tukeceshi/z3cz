import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";

import { bootstrapManifestPlugin } from "./vite-plugin-bootstrap-manifest";

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
    bootstrapManifestPlugin(),
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
});
