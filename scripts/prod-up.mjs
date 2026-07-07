#!/usr/bin/env node
/**
 * 容器内构建并启动实验性生产栈。
 *
 * 用法：
 *   node scripts/prod-up.mjs           构建镜像并启动
 *   node scripts/prod-up.mjs --no-build  不重建镜像，仅启动
 *   node scripts/prod-up.mjs --down      停止
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.docker.prod");

const args = process.argv.slice(2);
const tearDown = args.includes("--down");
const noBuild = args.includes("--no-build");

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (tearDown) {
  run("docker", [
    "compose",
    "-f",
    "docker-compose.prod.yml",
    "--env-file",
    ".env.docker.prod",
    "down",
  ]);
  process.exit(0);
}

if (!fs.existsSync(envFile)) {
  console.error(
    "[prod-up] 缺少 .env.docker.prod，请先：pnpm prod:env  或  cp .env.docker.prod.example .env.docker.prod"
  );
  process.exit(1);
}

const composeArgs = [
  "compose",
  "-f",
  "docker-compose.prod.yml",
  "--env-file",
  ".env.docker.prod",
  "up",
  "-d",
];

if (!noBuild) {
  composeArgs.push("--build");
}

console.log("[prod-up] 构建并启动 Postgres + API + www + app + smtp-gateway...");
run("docker", composeArgs);

console.log("");
console.log("  www  http://localhost:3100");
console.log("  app  http://localhost:3101");
console.log("  api  http://localhost:3102/health");
console.log("  smtp localhost:2525");
console.log("");
console.log("停止：pnpm prod:down");
