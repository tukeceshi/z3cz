#!/usr/bin/env node
/**
 * Interactive first-time setup for Docker self-host (Discourse-style).
 * Does NOT create an admin user — first register in the app becomes platform admin.
 * Prefer ./dafthunk-setup (bash). This .mjs is a fallback; ends with ./launcher rebuild unless --no-rebuild.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { stringifyAppYml } from "./lib/parse-app-yml.mjs";
import {
  appYmlPath,
  containersDir,
  dockerHostRoot,
  ensureHostDirs,
  repoRoot,
  samplesDir,
} from "./lib/paths.mjs";
import { publicOrigin } from "./lib/render.mjs";
import { generateHexSecret, isPlaceholderSecret } from "./lib/secrets.mjs";

const skipRebuild = process.argv.includes("--no-rebuild");

function looksLikeLocalHost(hostname) {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }
  return false;
}

async function main() {
  ensureHostDirs();
  const rl = readline.createInterface({ input, output });

  console.log("Dafthunk self-host setup");
  console.log("------------------------");
  console.log(
    "Admin account: open the site after rebuild and register — the first user becomes platform admin."
  );
  console.log("");

  const hostname =
    (
      await rl.question("Hostname [localhost]: ")
    ).trim() || "localhost";

  const local = looksLikeLocalHost(hostname);
  let https = !local;
  if (!local) {
    const httpsAnswer = (
      await rl.question("Enable HTTPS / Let's Encrypt? [Y/n]: ")
    )
      .trim()
      .toLowerCase();
    if (httpsAnswer === "n" || httpsAnswer === "no") {
      https = false;
    }
  } else {
    console.log("Local hostname detected — HTTPS disabled (HTTP only).");
    https = false;
  }

  let leEmail = "";
  if (https) {
    leEmail = (
      await rl.question(
        "ACME notification email (optional, Enter to skip): "
      )
    ).trim();
  }

  let httpPort = https ? 80 : 8080;
  let httpsPort = 443;
  if (!https) {
    const portAnswer = (
      await rl.question(`HTTP port [${httpPort}]: `)
    ).trim();
    if (portAnswer) {
      httpPort = Number(portAnswer) || httpPort;
    }
  } else {
    const httpAnswer = (await rl.question("HTTP port [80]: ")).trim();
    if (httpAnswer) {
      httpPort = Number(httpAnswer) || 80;
    }
    const httpsAnswer = (await rl.question("HTTPS port [443]: ")).trim();
    if (httpsAnswer) {
      httpsPort = Number(httpsAnswer) || 443;
    }
  }

  /** @type {Record<string, string>} */
  let existingEnv = {};
  if (fs.existsSync(appYmlPath)) {
    const { parseAppYml } = await import("./lib/parse-app-yml.mjs");
    try {
      existingEnv = parseAppYml(fs.readFileSync(appYmlPath, "utf8")).env;
      console.log("Existing containers/app.yml found — preserving secrets.");
    } catch {
      existingEnv = {};
    }
  }

  const webHost = publicOrigin(hostname, https, httpPort, httpsPort);

  const jwt =
    !isPlaceholderSecret(existingEnv.JWT_SECRET)
      ? existingEnv.JWT_SECRET
      : generateHexSecret(32);
  const master =
    !isPlaceholderSecret(existingEnv.SECRET_MASTER_KEY)
      ? existingEnv.SECRET_MASTER_KEY
      : generateHexSecret(32);

  const yaml = stringifyAppYml({
    hostname,
    https,
    le_email: leEmail,
    http_port: httpPort,
    https_port: httpsPort,
    env: {
      JWT_SECRET: jwt,
      SECRET_MASTER_KEY: master,
      WEB_HOST: webHost,
      WEBSITE_URL: webHost,
    },
  });

  fs.mkdirSync(containersDir, { recursive: true });
  fs.writeFileSync(appYmlPath, yaml, "utf8");

  // Keep sample path discoverable
  const sample = path.join(samplesDir, "standalone.yml");
  if (!fs.existsSync(sample)) {
    console.warn("Warning: samples/standalone.yml missing");
  }

  rl.close();

  console.log("");
  console.log(`Wrote ${path.relative(repoRoot, appYmlPath)}`);
  console.log(`Public URL: ${webHost}`);
  console.log("");

  if (skipRebuild) {
    console.log("Skipped rebuild (--no-rebuild). Next: ./launcher rebuild");
    console.log(
      `Then open ${webHost} and register the first user (platform admin).`
    );
    return;
  }

  console.log("Starting ./launcher rebuild...");
  console.log(
    `When ready, open ${webHost} and register the first user (platform admin).`
  );
  console.log("");

  const launcherSh = path.join(dockerHostRoot, "launcher");
  const launcherMjs = path.join(dockerHostRoot, "launcher.mjs");
  const viaBash = spawnSync("bash", [launcherSh, "rebuild"], {
    cwd: dockerHostRoot,
    stdio: "inherit",
  });
  if (!viaBash.error) {
    process.exit(viaBash.status ?? 1);
  }
  const viaNode = spawnSync(process.execPath, [launcherMjs, "rebuild"], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    stdio: "inherit",
  });
  process.exit(viaNode.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
