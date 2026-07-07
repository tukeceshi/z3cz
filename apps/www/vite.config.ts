import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isNodeTarget =
    process.env.DAFTHUNK_WWW_TARGET === "node" || mode === "docker-prod";

  return {
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
