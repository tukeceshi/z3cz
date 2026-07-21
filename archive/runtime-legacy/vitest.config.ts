import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workflows": new URL(
        "../runtime/src/__test-stubs__/cloudflare-workflows.ts",
        import.meta.url
      ).pathname,
      "@cloudflare/sandbox": new URL(
        "../runtime/src/__test-stubs__/cloudflare-sandbox.ts",
        import.meta.url
      ).pathname,
    },
  },
});
