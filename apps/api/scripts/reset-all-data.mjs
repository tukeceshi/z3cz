#!/usr/bin/env node
/**
 * Wipes all application data from Postgres (users, orgs, workflows, etc.).
 * Does NOT remove local file storage under LOCAL_STORAGE_PATH.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/reset-all-data.mjs
 *   pnpm --filter '@dafthunk/api' db:reset
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const TABLES = [
  "api_keys",
  "attachments",
  "bot_triggers",
  "bots",
  "databases",
  "datasets",
  "email_triggers",
  "emails",
  "feedback",
  "feedback_criteria",
  "inboxes",
  "integrations",
  "invitations",
  "memberships",
  "messages",
  "organizations",
  "queue_triggers",
  "queues",
  "scheduled_triggers",
  "schemas",
  "secrets",
  "thread_reads",
  "threads",
  "users",
  "workflows",
];

function loadDevVars() {
  const devVarsPath = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(devVarsPath)) {
    return {};
  }

  const content = readFileSync(devVarsPath, "utf8");
  const vars = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    vars[key] = value;
  }

  return vars;
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const devVars = loadDevVars();
  if (devVars.DATABASE_URL) {
    return devVars.DATABASE_URL;
  }

  throw new Error(
    "DATABASE_URL is required (env var or apps/api/.dev.vars)"
  );
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const tableList = TABLES.map((table) => `"${table}"`).join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    console.log(`Truncated ${TABLES.length} tables. All users and data removed.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
