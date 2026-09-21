import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveHere() {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.dirname(process.execPath);
  }
}

const here = resolveHere();

export const updaterRoot = here;
export const installDir = path.resolve(
  process.env.Z3CZ_INSTALL_DIR || process.env.DAFTHUNK_INSTALL_DIR || path.resolve(here, "../../..")
);
export const hostDir = path.join(installDir, "docker-host");
export const appYmlPath = path.join(hostDir, "containers", "app.yml");
export const composePath = path.join(hostDir, "docker-compose.generated.yml");
export const envPath = path.join(hostDir, ".env.generated");
export const storageDir = path.join(hostDir, "shared", "storage");
export const defaultStateDir =
  process.env.Z3CZ_UPDATER_STATE_DIR || "/var/lib/z3cz-updater";
export const defaultBackupDir =
  process.env.Z3CZ_UPDATER_BACKUP_DIR || path.join(hostDir, "shared", "backups");
export const defaultSocketPath =
  process.env.Z3CZ_UPDATER_SOCKET || "/run/z3cz-updater/updater.sock";
export const defaultRepository =
  process.env.Z3CZ_UPDATER_REPOSITORY || "tukeceshi/z3cz";
export const apiImageName =
  process.env.Z3CZ_API_IMAGE || "tukeceshi/z3cz-api";
export const appImageName =
  process.env.Z3CZ_APP_IMAGE || "tukeceshi/z3cz-app";
