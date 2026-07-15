import { validateJwtSecret } from "../auth/jwt-config";

const INSECURE_SECRET_PREFIX = "dev-insecure-";
const PLACEHOLDER_SECRETS = new Set(["CHANGE_ME", "your-secret-key", "development"]);

export function isRunningInDocker(): boolean {
  return process.env.CI === "true" || process.env.RUNTIME === "docker";
}

export function isStrictSecretsMode(env: Record<string, string>): boolean {
  return isRunningInDocker() || env.CLOUDFLARE_ENV === "production";
}

export function isInsecureSecret(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  if (PLACEHOLDER_SECRETS.has(value)) {
    return true;
  }
  if (value.startsWith(INSECURE_SECRET_PREFIX)) {
    return true;
  }
  return false;
}

export function validateMasterKey(secret: string): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error("SECRET_MASTER_KEY must be 64 hex characters (32 bytes)");
  }
}

export function validateStartupSecrets(env: Record<string, string>): void {
  if (!isStrictSecretsMode(env)) {
    return;
  }

  if (isInsecureSecret(env.JWT_SECRET)) {
    throw new Error(
      "JWT_SECRET is missing or insecure in Docker/production mode"
    );
  }

  if (isInsecureSecret(env.SECRET_MASTER_KEY)) {
    throw new Error(
      "SECRET_MASTER_KEY is missing or insecure in Docker/production mode"
    );
  }

  validateJwtSecret(env.JWT_SECRET ?? "");
  validateMasterKey(env.SECRET_MASTER_KEY ?? "");
}

export function resolveSecret(
  env: Record<string, string>,
  key: "JWT_SECRET" | "SECRET_MASTER_KEY",
  insecureFallback: string
): string {
  const value = env[key];
  if (isStrictSecretsMode(env)) {
    if (isInsecureSecret(value)) {
      throw new Error(`${key} is missing or insecure in Docker/production mode`);
    }
    return value ?? "";
  }

  return isInsecureSecret(value) ? insecureFallback : (value ?? insecureFallback);
}
