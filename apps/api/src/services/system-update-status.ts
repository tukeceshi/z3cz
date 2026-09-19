import type { SystemUpdateStatus } from "@dafthunk/types";

import type { Bindings } from "../context";

export const SYSTEM_UPDATE_REPOSITORY = "tukeceshi/z3cz";

export function disconnectedUpdateStatus(
  env: Bindings,
  extras: Partial<SystemUpdateStatus> = {}
): SystemUpdateStatus {
  const runtime =
    env.RUNTIME === "node" ? "docker-self-host" : "cloudflare-workers";
  return {
    supported: false,
    connected: false,
    repository: SYSTEM_UPDATE_REPOSITORY,
    deployment: runtime,
    currentVersion: env.APP_VERSION || "unknown",
    updateAvailable: false,
    checks: [],
    operation: {
      phase: "idle",
      automaticRollback: false,
      logs: [],
    },
    ...extras,
  };
}
