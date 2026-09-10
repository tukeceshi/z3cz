import fs from "node:fs";
import path from "node:path";

import { getApiRootPath } from "../env/api-root";

export const PERSIST_WORKER_INSTALL_DIR = "/opt/dafthunk-persist-worker";

export interface PersistWorkerInstallScriptParams {
  readonly workerId: string;
  readonly workerSecret: string;
  readonly apiBaseUrl: string;
  readonly sshPassword: string;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Frontend origin (WEB_HOST) is reverse-proxied at `/api`; the worker calls `/internal/...`. */
export function derivePersistWorkerApiBaseUrlFromWebHost(
  webOrigin: string
): string {
  const trimmed = webOrigin.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

export function isLoopbackPersistWorkerApiBaseUrl(apiBaseUrl: string): boolean {
  try {
    const { hostname } = new URL(apiBaseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
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
  params: PersistWorkerInstallScriptParams,
  workerSource: string = readPersistWorkerBundleSource()
): string {
  const installDir = PERSIST_WORKER_INSTALL_DIR;

  return `# dafthunk persist worker bootstrap
set -euo pipefail
INSTALL_DIR=${shellQuote(installDir)}
SUDO_PASSWORD=${shellQuote(params.sshPassword)}
STAGE_DIR="$(mktemp -d /tmp/dafthunk-persist-worker.XXXXXX)"
trap 'rm -rf "$STAGE_DIR"; unset SUDO_PASSWORD' EXIT

cat > "$STAGE_DIR/worker.mjs" <<'__DAFTHUNK_WORKER__'
${workerSource}
__DAFTHUNK_WORKER__

echo ${shellQuote(`API_BASE_URL=${params.apiBaseUrl}`)}
${
    isLoopbackPersistWorkerApiBaseUrl(params.apiBaseUrl)
      ? `echo ${shellQuote(
          "WARNING: API_BASE_URL points at localhost; a remote worker cannot reach this API. Set a public API URL (frontend /api or host:3102) when initializing."
        )}`
      : ""
  }

cat > "$STAGE_DIR/env" <<'__DAFTHUNK_ENV__'
API_BASE_URL=${params.apiBaseUrl}
WORKER_ID=${params.workerId}
WORKER_SECRET=${params.workerSecret}
POLL_INTERVAL_MS=5000
__DAFTHUNK_ENV__

cat > "$STAGE_DIR/install.sh" <<'__DAFTHUNK_INSTALL__'
#!/bin/bash
set -euo pipefail
STAGE_DIR="$1"
INSTALL_DIR="${installDir}"

mkdir -p "$INSTALL_DIR"
cp "$STAGE_DIR/worker.mjs" "$INSTALL_DIR/worker.mjs"
cp "$STAGE_DIR/env" "$INSTALL_DIR/env"
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

if command -v systemctl >/dev/null 2>&1; then
  tee /etc/systemd/system/dafthunk-persist-worker.service >/dev/null <<EOF
[Unit]
Description=Dafthunk Persist Worker
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/env
ExecStart=$NODE_BIN $INSTALL_DIR/worker.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable dafthunk-persist-worker
  systemctl restart dafthunk-persist-worker
  systemctl is-active --quiet dafthunk-persist-worker
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
__DAFTHUNK_INSTALL__

if [ "$(id -u)" -eq 0 ]; then
  bash "$STAGE_DIR/install.sh" "$STAGE_DIR"
elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  sudo -n bash "$STAGE_DIR/install.sh" "$STAGE_DIR"
elif command -v sudo >/dev/null 2>&1 && [ -n "$SUDO_PASSWORD" ]; then
  if ! printf '%s\\n' "$SUDO_PASSWORD" | sudo -S -p '' bash "$STAGE_DIR/install.sh" "$STAGE_DIR"; then
    echo "Cannot create $INSTALL_DIR: SSH user is not root and sudo rejected the password."
    echo "Use root, or grant this user sudo (NOPASSWD or the same password as SSH)."
    exit 1
  fi
else
  echo "Cannot create $INSTALL_DIR: SSH user is not root and sudo is unavailable."
  echo "Use root, or install/configure sudo for this user."
  exit 1
fi
`;
}
