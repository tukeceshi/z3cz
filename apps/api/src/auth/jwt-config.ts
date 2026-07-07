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
  return `[api] Invalid JWT_SECRET: ${message}. Run "node apps/api/scripts/generate-master-key.js" and update apps/api/.dev.vars`;
}
