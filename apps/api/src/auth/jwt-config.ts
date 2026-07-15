const WEAK_JWT_SECRETS = new Set(["your-secret-key", "development", "CHANGE_ME"]);

export function validateJwtSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  if (WEAK_JWT_SECRETS.has(secret)) {
    throw new Error("JWT_SECRET must not use default/weak values");
  }
}

export function formatJwtSecretStartupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[api] Invalid startup secrets: ${message}. Docker dev writes JWT_SECRET and SECRET_MASTER_KEY to /data/secrets/.dev.vars automatically. Host-only dev may use apps/api/.dev.vars or node apps/api/scripts/generate-master-key.mjs`;
}
