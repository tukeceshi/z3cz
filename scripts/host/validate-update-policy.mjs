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
if (
  !fs.existsSync(path.join(root, "docker/Dockerfile.update")) ||
  fs.readFileSync(path.join(root, "docker/source-protocol"), "utf8").trim() !==
    "2"
) {
  throw new Error("缺少镜像更新协议文件");
}
databaseFingerprint(root);
console.log("Update policy and database files validated");
