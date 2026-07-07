import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const ReactCompilerConfig = {};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3102",
        changeOrigin: true,
        ws: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
    },
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
