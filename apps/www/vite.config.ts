import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function resolveWwwBase(): string {
  const raw = process.env.VITE_WWW_BASENAME?.trim();
  if (!raw || raw === "/") {
    return "/";
  }
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig(({ mode }) => {
  const isNodeTarget =
    process.env.DAFTHUNK_WWW_TARGET === "node" || mode === "docker-prod";

  return {
    base: resolveWwwBase(),
    plugins: [
      ...(isNodeTarget
        ? []
        : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
      tailwindcss(),
      reactRouter(),
    ],
    server: {
      port: 3100,
      host: true,
    },
  };
});
