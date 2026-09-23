import fs from "node:fs";
import path from "node:path";
import {
  readUpdatePolicy,
  databaseFingerprint,
} from "./updater/update-policy.mjs";

const root = process.cwd();
const policy = readUpdatePolicy(root);
if (!policy || policy.format !== 2)
  throw new Error("update-policy.json 必须使用 format 2");
for (const file of [
  "apps/api/src/production-migrate.ts",
  "deploy/api/package.json",
  "deploy/api/pnpm-lock.yaml",
  "docker-compose.prod.yml",
]) if (!fs.existsSync(path.join(root, file))) throw new Error(`缺少发布文件 ${file}`);
databaseFingerprint(root);
console.log("Update policy and database files validated");
