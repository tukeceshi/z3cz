#!/usr/bin/env node
/**
 * Discourse-style launcher for Dafthunk Docker self-host.
 *
 * Usage:
 *   node docker-host/launcher.mjs <command>
 *   docker-host/launcher <command>          (Unix)
 *   docker-host\launcher.cmd <command>      (Windows)
 *
 * Commands: bootstrap | rebuild | start | stop | restart | destroy | logs | enter | status | render
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  appYmlPath,
  dockerHostRoot,
  generatedComposePath,
  generatedEnvPath,
  repoRoot,
} from "./lib/paths.mjs";
import { writeGeneratedFiles } from "./lib/render.mjs";

const command = process.argv[2] ?? "help";
const rest = process.argv.slice(3);

function printHelp() {
  console.log(`Dafthunk host launcher

Usage: ./launcher <command>
       (fallback: node docker-host/launcher.mjs <command>)

Commands:
  render      Generate compose / Caddyfile / env from containers/app.yml
  bootstrap   Alias of rebuild (first install)
  rebuild     Build images, recreate stack (keeps shared/ data)
  start       Start existing stack
  stop        Stop stack
  restart     Restart stack
  destroy     Remove containers (keeps shared/)
  logs        docker compose logs (pass-through args)
  enter       Shell into a service: enter api|app|caddy|postgres
  status      docker compose ps
  help        Show this help

First install:
  ./dafthunk-setup
  ./launcher rebuild
`);
}

function requireAppYml() {
  if (!fs.existsSync(appYmlPath)) {
    console.error(
      `Missing containers/app.yml.\nRun: ./dafthunk-setup  (writes config and rebuilds)\nOr:  cp samples/standalone.yml containers/app.yml`
    );
    process.exit(1);
  }
}

/**
 * @param {string[]} args
 * @param {{ inherit?: boolean }} [opts]
 */
function compose(args, opts = {}) {
  const inherit = opts.inherit !== false;
  const bin = process.platform === "win32" ? "docker" : "docker";
  const fullArgs = [
    "compose",
    "-f",
    generatedComposePath,
    "--env-file",
    generatedEnvPath,
    ...args,
  ];
  if (inherit) {
    const result = spawnSync(bin, fullArgs, {
      cwd: dockerHostRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) {
      throw result.error;
    }
    return result.status ?? 1;
  }
  return spawnSync(bin, fullArgs, {
    cwd: dockerHostRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

function render() {
  requireAppYml();
  const config = writeGeneratedFiles();
  console.log("Generated:");
  console.log(`  ${path.relative(repoRoot, generatedComposePath)}`);
  console.log(`  ${path.relative(repoRoot, path.join(dockerHostRoot, "Caddyfile.generated"))}`);
  console.log(`  ${path.relative(repoRoot, generatedEnvPath)}`);
  console.log(`Public origin: ${config.origin}`);
  if (!config.https) {
    const port = config.http_port === 80 ? "" : `:${config.http_port}`;
    console.log(`Open: http://${config.hostname}${port}`);
  } else {
    console.log(`Open: https://${config.hostname}`);
  }
  console.log(
    "After start: register the first user in the UI — they become platform admin."
  );
  return config;
}

async function main() {
  switch (command) {
    case "help":
    case "-h":
    case "--help":
      printHelp();
      return;
    case "render":
      render();
      return;
    case "bootstrap":
    case "rebuild": {
      render();
      // Sequential builds avoid OOM on small VPS (parallel bake).
      console.log("Building images sequentially (api → www → app)...");
      for (const service of ["api", "www", "app"]) {
        const buildCode = compose(["build", service]);
        if (buildCode !== 0) {
          process.exit(buildCode);
        }
      }
      process.exit(compose(["up", "-d", "--remove-orphans"]) === 0 ? 0 : 1);
      return;
    }
    case "start": {
      render();
      process.exit(compose(["up", "-d"]) === 0 ? 0 : 1);
      return;
    }
    case "stop": {
      requireAppYml();
      if (!fs.existsSync(generatedComposePath)) {
        render();
      }
      process.exit(compose(["stop"]) === 0 ? 0 : 1);
      return;
    }
    case "restart": {
      requireAppYml();
      if (!fs.existsSync(generatedComposePath)) {
        render();
      }
      process.exit(compose(["restart"]) === 0 ? 0 : 1);
      return;
    }
    case "destroy": {
      requireAppYml();
      if (!fs.existsSync(generatedComposePath)) {
        render();
      }
      console.log("Removing containers (shared/ data kept)...");
      process.exit(compose(["down", "--remove-orphans"]) === 0 ? 0 : 1);
      return;
    }
    case "logs": {
      requireAppYml();
      if (!fs.existsSync(generatedComposePath)) {
        render();
      }
      process.exit(compose(["logs", ...rest]) === 0 ? 0 : 1);
      return;
    }
    case "status":
    case "ps": {
      requireAppYml();
      if (!fs.existsSync(generatedComposePath)) {
        render();
      }
      process.exit(compose(["ps", ...rest]) === 0 ? 0 : 1);
      return;
    }
    case "enter": {
      const service = rest[0];
      if (!service) {
        console.error("Usage: launcher enter api|app|caddy|postgres");
        process.exit(1);
      }
      requireAppYml();
      if (!fs.existsSync(generatedComposePath)) {
        render();
      }
      const shell = service === "postgres" ? "sh" : "sh";
      process.exit(
        compose(["exec", "-it", service, shell, ...rest.slice(1)]) === 0 ? 0 : 1
      );
      return;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
