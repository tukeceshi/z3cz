import { formatJwtSecretStartupError, validateJwtSecret } from "./auth/jwt-config";
import { loadNodeEnv } from "./env/load-node-env";

console.log("[api] Process started, validating config...");

const envVars = loadNodeEnv();

try {
  validateJwtSecret(envVars.JWT_SECRET ?? "");
} catch (error) {
  console.error(formatJwtSecretStartupError(error));
  process.exit(1);
}

console.log(
  "[api] Loading runtime (WASM init may take 2–6 minutes in Docker)..."
);

void import("./server-bootstrap.js")
  .then(({ runServer }) => runServer(envVars))
  .catch((error: unknown) => {
    console.error("[api] Failed to start:", error);
    process.exit(1);
  });
