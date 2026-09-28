import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/env/api-boot-cache.test.ts",
      "src/services/system-update-preparer-node.test.ts",
    ],
    environment: "node",
  },
});
