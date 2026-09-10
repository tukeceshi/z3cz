import type { BootstrapPersistWorkerRequest, PersistWorker } from "@dafthunk/types";
import { Client } from "ssh2";

import type { Bindings } from "../context";
import type { Database } from "../db";
import {
  buildBootstrapPersistWorkerInput,
  createPersistWorker,
  generatePersistWorkerSecret,
  getPersistWorkerById,
  hashPersistWorkerSecret,
  updatePersistWorkerDeployState,
} from "../db/persist-worker-queries";
import {
  buildPersistWorkerInstallScript,
  derivePersistWorkerApiBaseUrlFromWebHost,
} from "./persist-worker-install-script";

interface SshExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

interface DeployPersistWorkerParams {
  readonly host: string;
  readonly sshPort: number;
  readonly sshUsername: string;
  readonly sshPassword: string;
  readonly workerId: string;
  readonly workerSecret: string;
  readonly apiBaseUrl: string;
}

function resolvePersistWorkerApiBaseUrl(
  env: Bindings,
  override?: string
): string {
  const trimmedOverride = override?.trim().replace(/\/$/, "");
  if (trimmedOverride) {
    return trimmedOverride;
  }

  for (const candidate of [env.WEB_HOST, env.WEBSITE_URL]) {
    const trimmed = candidate?.trim().replace(/\/$/, "");
    if (trimmed) {
      return derivePersistWorkerApiBaseUrlFromWebHost(trimmed);
    }
  }

  throw new Error(
    "API base URL is not configured. Set WEB_HOST or provide apiBaseUrl."
  );
}

async function execSshScript(
  params: DeployPersistWorkerParams,
  script: string
): Promise<SshExecResult> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = "";
    let stderr = "";

    conn
      .on("ready", () => {
        conn.exec(`bash -s`, (error, stream) => {
          if (error) {
            conn.end();
            reject(error);
            return;
          }

          stream
            .on("close", (exitCode: number) => {
              conn.end();
              resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
            })
            .on("data", (chunk: Buffer) => {
              stdout += chunk.toString("utf8");
            });

          stream.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
          });

          stream.end(script);
        });
      })
      .on("error", reject)
      .connect({
        host: params.host,
        port: params.sshPort,
        username: params.sshUsername,
        password: params.sshPassword,
        readyTimeout: 20_000,
      });
  });
}

async function deployPersistWorkerOverSsh(
  params: DeployPersistWorkerParams
): Promise<string> {
  const script = buildPersistWorkerInstallScript(params);
  const result = await execSshScript(params, script);

  const deployLog = [result.stdout.trim(), result.stderr.trim()]
    .filter(Boolean)
    .join("\n");

  if (result.exitCode !== 0) {
    throw new Error(
      deployLog || `Remote install failed with exit code ${result.exitCode}`
    );
  }

  return deployLog;
}

export async function bootstrapPersistWorker(
  env: Bindings,
  db: Database,
  input: BootstrapPersistWorkerRequest,
  updatedBy: string,
  organizationId?: string
): Promise<{ readonly worker: PersistWorker; readonly deployLog: string }> {
  if (env.RUNTIME === "workers") {
    throw new Error("SSH bootstrap requires the Node API runtime");
  }

  const normalized = buildBootstrapPersistWorkerInput(input, organizationId);
  const existing = await getPersistWorkerById(db, normalized.id);
  if (existing) {
    throw new Error(`Persist worker id "${normalized.id}" already exists`);
  }

  const secret = generatePersistWorkerSecret();
  const secretHash = await hashPersistWorkerSecret(secret);
  const apiBaseUrl = resolvePersistWorkerApiBaseUrl(env, input.apiBaseUrl);

  const worker = await createPersistWorker(
    db,
    {
      id: normalized.id,
      organizationId: organizationId ?? null,
      name: input.name.trim(),
      enabled: true,
      maxConcurrentJobs: input.maxConcurrentJobs ?? 1,
      secretHash,
      host: normalized.host,
      sshPort: normalized.sshPort,
      sshUsername: input.sshUsername.trim(),
      deployStatus: "deploying",
      lastDeployAt: new Date(),
    },
    updatedBy
  );

  try {
    const deployLog = await deployPersistWorkerOverSsh({
      host: normalized.host,
      sshPort: normalized.sshPort,
      sshUsername: input.sshUsername.trim(),
      sshPassword: input.sshPassword,
      workerId: worker.id,
      workerSecret: secret,
      apiBaseUrl,
    });

    const active = await updatePersistWorkerDeployState(db, worker.id, {
      deployStatus: "active",
      deployError: null,
      initializedAt: new Date(),
      lastDeployAt: new Date(),
    });

    return { worker: active, deployLog };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Remote bootstrap failed";
    const failed = await updatePersistWorkerDeployState(db, worker.id, {
      deployStatus: "failed",
      deployError: message,
      lastDeployAt: new Date(),
    });
    throw Object.assign(new Error(message), { worker: failed });
  }
}

export async function redeployPersistWorker(
  env: Bindings,
  db: Database,
  workerId: string,
  input: { readonly sshPassword: string; readonly apiBaseUrl?: string },
  organizationId?: string
): Promise<{ readonly worker: PersistWorker; readonly deployLog: string }> {
  if (env.RUNTIME === "workers") {
    throw new Error("SSH bootstrap requires the Node API runtime");
  }

  const worker = await getPersistWorkerById(db, workerId, organizationId);
  if (!worker) {
    throw new Error("Persist worker not found");
  }
  if (!worker.host || !worker.sshUsername) {
    throw new Error("Worker has no saved SSH host configuration");
  }

  const secret = generatePersistWorkerSecret();
  const secretHash = await hashPersistWorkerSecret(secret);
  const apiBaseUrl = resolvePersistWorkerApiBaseUrl(env, input.apiBaseUrl);

  await updatePersistWorkerDeployState(db, workerId, {
    deployStatus: "deploying",
    deployError: null,
    secretHash,
    lastDeployAt: new Date(),
  });

  try {
    const deployLog = await deployPersistWorkerOverSsh({
      host: worker.host,
      sshPort: worker.sshPort,
      sshUsername: worker.sshUsername,
      sshPassword: input.sshPassword,
      workerId: worker.id,
      workerSecret: secret,
      apiBaseUrl,
    });

    const active = await updatePersistWorkerDeployState(db, workerId, {
      deployStatus: "active",
      deployError: null,
      initializedAt: worker.initializedAt ? undefined : new Date(),
      lastDeployAt: new Date(),
    });

    return { worker: active, deployLog };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Remote redeploy failed";
    const failed = await updatePersistWorkerDeployState(db, workerId, {
      deployStatus: "failed",
      deployError: message,
      lastDeployAt: new Date(),
    });
    throw Object.assign(new Error(message), { worker: failed });
  }
}
