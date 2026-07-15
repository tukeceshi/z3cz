/**
 * Generate local development secrets.
 *
 * Usage:
 *   node apps/api/scripts/generate-master-key.mjs
 *   node apps/api/scripts/generate-master-key.mjs --merge --output /data/secrets/.dev.vars
 */

import fs from "node:fs";
import path from "node:path";

function generateHexKey(byteLength) {
  const keyBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(keyBytes);
  return Array.from(keyBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseDevVars(contents) {
  const parsed = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function formatDevVars(parsed) {
  const lines = [
    "# Auto-generated development secrets — do not commit",
    `JWT_SECRET=${parsed.JWT_SECRET}`,
    `SECRET_MASTER_KEY=${parsed.SECRET_MASTER_KEY}`,
    "",
  ];
  return lines.join("\n");
}

function isPlaceholderSecret(value) {
  if (!value) {
    return true;
  }
  if (value === "CHANGE_ME") {
    return true;
  }
  if (value.startsWith("dev-insecure-")) {
    return true;
  }
  return false;
}

function parseArgs(argv) {
  let outputPath = null;
  let merge = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--merge") {
      merge = true;
      continue;
    }
    if (arg === "--output" && argv[index + 1]) {
      outputPath = argv[index + 1];
      index += 1;
    }
  }

  return { outputPath, merge };
}

const generated = {
  JWT_SECRET: generateHexKey(32),
  SECRET_MASTER_KEY: generateHexKey(32),
};

const { outputPath, merge } = parseArgs(process.argv.slice(2));

if (outputPath) {
  const resolvedOutput = path.resolve(outputPath);
  const existing =
    merge && fs.existsSync(resolvedOutput)
      ? parseDevVars(fs.readFileSync(resolvedOutput, "utf8"))
      : {};

  const merged = {
    JWT_SECRET: isPlaceholderSecret(existing.JWT_SECRET)
      ? generated.JWT_SECRET
      : existing.JWT_SECRET,
    SECRET_MASTER_KEY: isPlaceholderSecret(existing.SECRET_MASTER_KEY)
      ? generated.SECRET_MASTER_KEY
      : existing.SECRET_MASTER_KEY,
  };

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, formatDevVars(merged), "utf8");
  console.log(`[generate-master-key] Wrote secrets to ${resolvedOutput}`);
} else {
  console.log("Generated development secrets (store these securely):");
  console.log("");
  console.log(`JWT_SECRET=${generated.JWT_SECRET}`);
  console.log(`SECRET_MASTER_KEY=${generated.SECRET_MASTER_KEY}`);
  console.log("");
  console.log(
    "Docker dev: secrets are written automatically to /data/secrets/.dev.vars"
  );
  console.log(
    "Host-only dev: add both lines to apps/api/.dev.vars or run with --output"
  );
}
