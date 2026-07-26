import type { Config } from "@react-router/dev/config";

const rawBasename = process.env.VITE_WWW_BASENAME?.trim();
const basename =
  rawBasename && rawBasename !== "/" ? rawBasename.replace(/\/$/, "") : undefined;

export default {
  appDirectory: "src",
  buildDirectory: "build",
  serverBuildFile: "index.js",
  ssr: true,
  ...(basename ? { basename } : {}),
  future: {
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
