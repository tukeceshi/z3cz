import fs from "node:fs";
import path from "node:path";

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
import { getApiRootPath } from "../env/api-root";

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
      return trimmed;
    }
  }

  throw new Error(
    "API base URL is not configured. Set WEB_HOST or provide apiBaseUrl."
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function readPersistWorkerBundleSource(): string {
  const bundlePath = path.resolve(
    getApiRootPath(),
    "../persist-worker/worker.mjs"
  );

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Persist worker bundle not found at ${bundlePath}`);
  }

  return fs.readFileSync(bundlePath, "utf8");
}

export function buildPersistWorkerInstallScript(
  params: DeployPersistWorkerParams
): string {
  const workerSource = readPersistWorkerBundleSource();
  const installDir = "/opt/dafthunk-persist-worker";

  return `# dafthunk persist worker bootstrap
set -euo pipefail
INSTALL_DIR=${shellQuote(installDir)}
mkdir -p "$INSTALL_DIR"

cat > "$INSTALL_DIR/worker.mjs" <<'__DAFTHUNK_WORKER__'
${workerSource}
__DAFTHUNK_WORKER__

cat > "$INSTALL_DIR/env" <<EOF
API_BASE_URL=${params.apiBaseUrl}
WORKER_ID=${params.workerId}
WORKER_SECRET=${params.workerSecret}
POLL_INTERVAL_MS=5000
EOF
chmod 600 "$INSTALL_DIR/env"

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo "Node.js 18+ is required but automatic install is unsupported on this OS."
    exit 1
  fi
fi

NODE_BIN="$(command -v node)"
echo "Using node: $NODE_BIN ($($NODE_BIN -v))"

if command -v systemctl >/dev/null 2>&1 && { [ "$(id -u)" -eq 0 ] || command -v sudo >/dev/null 2>&1; }; then
  SUDO=""
  if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo -n"
  fi

  $SUDO tee /etc/systemd/system/dafthunk-persist-worker.service >/dev/null <<EOF
[Unit]
Description=Dafthunk Persist Worker
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${installDir}
EnvironmentFile=${installDir}/env
ExecStart=${installDir}/worker-placeholder
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  $SUDO sed -i "s|^ExecStart=.*|ExecStart=$NODE_BIN ${installDir}/worker.mjs|" /etc/systemd/system/dafthunk-persist-worker.service
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable dafthunk-persist-worker
  $SUDO systemctl restart dafthunk-persist-worker
  $SUDO systemctl is-active --quiet dafthunk-persist-worker
  echo "systemd service active"
else
  if [ -f "$INSTALL_DIR/worker.pid" ]; then
    OLD_PID="$(cat "$INSTALL_DIR/worker.pid" || true)"
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
      kill "$OLD_PID" || true
    fi
  fi
  nohup "$NODE_BIN" "$INSTALL_DIR/worker.mjs" >> "$INSTALL_DIR/worker.log" 2>&1 &
  echo $! > "$INSTALL_DIR/worker.pid"
  sleep 1
  kill -0 "$(cat "$INSTALL_DIR/worker.pid")"
  echo "background worker started"
fi
`;
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
  updatedBy: string
): Promise<{ readonly worker: PersistWorker; readonly deployLog: string }> {
  if (env.RUNTIME === "workers") {
    throw new Error("SSH bootstrap requires the Node API runtime");
  }

  const normalized = buildBootstrapPersistWorkerInput(input);
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
  input: { readonly sshPassword: string; readonly apiBaseUrl?: string }
): Promise<{ readonly worker: PersistWorker; readonly deployLog: string }> {
  if (env.RUNTIME === "workers") {
    throw new Error("SSH bootstrap requires the Node API runtime");
  }

  const worker = await getPersistWorkerById(db, workerId);
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
