#!/usr/bin/env node
/**
 * Docker 开发栈启动顺序：先启动 API，等待 /health 就绪后再启动 www 与 app，
 * 避免 app 代理在 API WASM 初始化期间大量报 ECONNREFUSED。
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const API_HEALTH_URL =
  process.env.API_HEALTH_URL ?? "http://127.0.0.1:3102/health";
const HEALTH_TIMEOUT_MS = Number(
  process.env.API_HEALTH_TIMEOUT_MS ?? 8 * 60_000
);
const POLL_MS = 2_000;

function spawnPnpm(args) {
  return spawn("pnpm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
}

function getApiExitError(api) {
  if (api.exitCode === null) {
    return null;
  }
  return `[dev:docker] API process exited with code ${api.exitCode} before becoming ready. Check logs above for startup errors.`;
}

async function waitForApi(api) {
  const startedAt = Date.now();
  let lastLoggedBucket = 0;
  let loggedWasmHint = false;

  console.log(
    `[dev:docker] Waiting for API at ${API_HEALTH_URL} (WASM init may take 2–6 minutes)...`
  );

  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    const exitError = getApiExitError(api);
    if (exitError) {
      throw new Error(exitError);
    }

    try {
      const response = await fetch(API_HEALTH_URL, {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) {
        console.log("[dev:docker] API is ready.");
        return;
      }
    } catch {
      // API still starting
    }

    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    const logBucket = Math.floor(elapsedSec / 30);
    if (logBucket > lastLoggedBucket) {
      lastLoggedBucket = logBucket;
      console.log(
        `[dev:docker] Still waiting for API (${elapsedSec}s elapsed)...`
      );
    }
    if (elapsedSec >= 60 && !loggedWasmHint) {
      loggedWasmHint = true;
      console.log(
        "[dev:docker] If logs show initSync(), WASM is loading — usually ready in ~5 minutes total."
      );
    }

    await sleep(POLL_MS);
  }

  throw new Error(
    `[dev:docker] API did not become ready within ${HEALTH_TIMEOUT_MS / 1000}s. Check docker logs for JWT_SECRET or startup errors.`
  );
}

function forwardExit(child, label) {
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[dev:docker] ${label} exited with signal ${signal}`);
      process.exit(1);
    }
    if (code !== 0 && code !== null) {
      console.error(`[dev:docker] ${label} exited with code ${code}`);
      process.exit(code);
    }
  });
}

const api = spawnPnpm(["--filter", "@dafthunk/api", "dev:docker"]);

try {
  await waitForApi(api);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (api.exitCode === null) {
    api.kill("SIGTERM");
  }
  process.exit(1);
}

console.log("[dev:docker] Starting www and app...");
const frontends = spawnPnpm([
  "--parallel",
  "--filter",
  "@dafthunk/www",
  "--filter",
  "@dafthunk/app",
  "dev:docker",
]);
forwardExit(api, "API");
forwardExit(frontends, "frontends");

api.on("exit", (code) => {
  frontends.kill("SIGTERM");
  process.exit(code ?? 0);
});

frontends.on("exit", (code) => {
  api.kill("SIGTERM");
  process.exit(code ?? 0);
});
