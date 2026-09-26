import { writeFileSync } from "node:fs";

import { formatJwtSecretStartupError } from "./auth/jwt-config";
import { writeBootPhase } from "./env/api-boot-cache";
import { loadNodeEnv } from "./env/load-node-env";
import { validateStartupSecrets } from "./env/startup-secrets";

function reportStartupFailure(): void {
  const file = process.env.API_STARTUP_FAILURE_FILE;
  if (file) {
    try {
      writeFileSync(file, "failed\n");
    } catch (error) {
      console.error("[api] Could not notify watcher:", error);
    }
  }
}

writeBootPhase("validating_config");
console.log("[api] Process started, validating config...");

const envVars = loadNodeEnv();

try {
  validateStartupSecrets(envVars);
} catch (error) {
  console.error(formatJwtSecretStartupError(error));
  reportStartupFailure();
  process.exit(1);
}

writeBootPhase("loading_runtime");
console.log("[api] Loading runtime module graph...");

void import("./server-bootstrap.js")
  .then(({ runServer }) => runServer(envVars))
  .catch((error: unknown) => {
    writeBootPhase("failed");
    console.error("[api] Failed to start:", error);
    reportStartupFailure();
    process.exit(1);
  });
