import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { getApiRootPath } from "./api-root";
import {
  getMigrationJournalHash,
  shouldSkipDatabaseMigrations,
  writeBootPhase,
  writeBootStamp,
} from "./api-boot-cache";
import { isInsecureSecret, isRunningInDocker } from "./startup-secrets";
import { parseDevVars } from "./parse-dev-vars";

const DEFAULT_SECRETS_FILE = "/data/secrets/.dev.vars";

function readDevVarsFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return parseDevVars(fs.readFileSync(filePath, "utf8"));
}

function secretsNeedGeneration(secrets: Record<string, string>): boolean {
  return (
    isInsecureSecret(secrets.JWT_SECRET) ||
    isInsecureSecret(secrets.SECRET_MASTER_KEY)
  );
}

export function ensureDockerSecretsFile(
  secretsFile = process.env.SECRETS_FILE ?? DEFAULT_SECRETS_FILE
): void {
  if (!isRunningInDocker()) {
    return;
  }

  const resolvedSecretsFile = path.resolve(secretsFile);
  const existing = readDevVarsFile(resolvedSecretsFile);
  if (fs.existsSync(resolvedSecretsFile) && !secretsNeedGeneration(existing)) {
    return;
  }

  const apiRoot = getApiRootPath();
  const result = spawnSync(
    process.execPath,
    [
      "scripts/generate-master-key.mjs",
      "--merge",
      "--output",
      resolvedSecretsFile,
    ],
    {
      cwd: apiRoot,
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `[api] Failed to generate Docker secrets at ${resolvedSecretsFile}`
    );
  }
}

function parseDatabaseTarget(databaseUrl: string): { host: string; port: number } {
  const normalized = databaseUrl.replace(/^postgresql:\/\//, "http://");
  const url = new URL(normalized);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
  };
}

async function canConnectToPostgres(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

export async function waitForPostgres(
  databaseUrl: string,
  maxAttempts = 30,
  delayMs = 1_000
): Promise<void> {
  writeBootPhase("waiting_postgres");
  const { host, port } = parseDatabaseTarget(databaseUrl);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await canConnectToPostgres(host, port)) {
      return;
    }
    console.log(
      `[api] Waiting for Postgres at ${host}:${port} (${attempt}/${maxAttempts})...`
    );
    await sleep(delayMs);
  }
  throw new Error(`[api] Postgres not reachable at ${host}:${port}`);
}

export function runDatabaseMigrations(databaseUrl: string): void {
  if (shouldSkipDatabaseMigrations()) {
    return;
  }

  const apiRoot = getApiRootPath();
  writeBootPhase("migrating");
  console.log("[api] Applying database migrations (idempotent)...");

  const result = spawnSync("pnpm", ["db:migrate"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error("[api] Database migration failed");
  }

  writeBootStamp({
    migrationJournalHash: getMigrationJournalHash(),
  });
}

export { getMigrationJournalHash } from "./api-boot-cache";
