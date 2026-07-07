#!/usr/bin/env node
/**
 * 从 apps/api/.dev.vars 同步密钥到 .env.docker.prod（不提交 git）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = path.join(root, ".env.docker.prod.example");
const devVarsPath = path.join(root, "apps/api/.dev.vars");
const outputPath = path.join(root, ".env.docker.prod");

function readKeyValueFile(filePath) {
  /** @type {Map<string, string>} */
  const values = new Map();
  if (!fs.existsSync(filePath)) {
    return values;
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    values.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }
  return values;
}

if (!fs.existsSync(examplePath)) {
  console.error("[sync-env-docker-prod] Missing .env.docker.prod.example");
  process.exit(1);
}

const example = readKeyValueFile(examplePath);
const devVars = readKeyValueFile(devVarsPath);

/** @type {Map<string, string>} */
const merged = new Map(example);
for (const key of ["JWT_SECRET", "SECRET_MASTER_KEY", "INBOUND_EMAIL_SECRET"]) {
  const fromDev = devVars.get(key);
  if (fromDev && !fromDev.includes("change-me") && !fromDev.includes("CHANGE_ME")) {
    merged.set(key, fromDev);
  }
}

if (!devVars.has("JWT_SECRET")) {
  console.warn(
    "[sync-env-docker-prod] apps/api/.dev.vars 无 JWT_SECRET，请手动编辑 .env.docker.prod"
  );
}

if (!merged.get("INBOUND_EMAIL_SECRET")?.trim()) {
  merged.set("INBOUND_EMAIL_SECRET", devVars.get("JWT_SECRET") ?? "dev-inbound-email-secret");
}

const lines = fs.readFileSync(examplePath, "utf8").split(/\r?\n/).map((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return line;
  }
  const index = trimmed.indexOf("=");
  if (index === -1) {
    return line;
  }
  const key = trimmed.slice(0, index);
  const value = merged.get(key);
  return value === undefined ? line : `${key}=${value}`;
});

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`[sync-env-docker-prod] Wrote ${outputPath}`);
