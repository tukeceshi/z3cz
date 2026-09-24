import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/services/system-update-preparer-node.test.ts"],
    environment: "node",
  },
});
