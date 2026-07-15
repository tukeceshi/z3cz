import fs from "node:fs";

import path from "node:path";



import { getApiRootPath } from "./api-root";

import { ensureDockerSecretsFile } from "./docker-bootstrap";

import { parseDevVars } from "./parse-dev-vars";

import { isRunningInDocker } from "./startup-secrets";



const apiRoot = getApiRootPath();

const DOCKER_SECRET_KEYS = ["JWT_SECRET", "SECRET_MASTER_KEY"] as const;



function resolveLocalStoragePath(pathValue: string | undefined): string {

  const defaultPath = isRunningInDocker()

    ? "/app/data/storage"

    : path.join(apiRoot, "data", "storage");



  if (!pathValue) {

    return defaultPath;

  }



  if (isRunningInDocker()) {

    if (/^[a-zA-Z]:[\\/]/.test(pathValue) || pathValue.includes("PORT=")) {

      return "/app/data/storage";

    }

    if (!pathValue.startsWith("/")) {

      return "/app/data/storage";

    }

  }



  return pathValue;

}



function resolveDatabaseUrl(url: string | undefined): string | undefined {

  if (!url) {

    return url;

  }



  if (isRunningInDocker() && /@(localhost|127\.0\.0\.1):5432/.test(url)) {

    return url.replace(

      /@(localhost|127\.0\.0\.1):5432/,

      "@supabase-db:5432"

    );

  }



  return url;

}



function loadSecretsOverlay(): Record<string, string> {

  const secretsFile = process.env.SECRETS_FILE;

  if (!secretsFile || !fs.existsSync(secretsFile)) {

    return {};

  }



  return parseDevVars(fs.readFileSync(secretsFile, "utf8"));

}



function omitKeys(

  source: Record<string, string>,

  keys: readonly string[]

): Record<string, string> {

  const next = { ...source };

  for (const key of keys) {

    delete next[key];

  }

  return next;

}



function warnOnDockerSecretKeyMismatch(

  fromDevVars: Record<string, string>,

  fromSecrets: Record<string, string>

): void {

  for (const key of DOCKER_SECRET_KEYS) {

    const devValue = fromDevVars[key];

    const secretsValue = fromSecrets[key];

    if (devValue && secretsValue && devValue !== secretsValue) {

      console.warn(

        `[api] apps/api/.dev.vars ${key} differs from K1 secrets volume; using volume value only.`

      );

    }

  }

}



export function loadNodeEnv(): Record<string, string> {

  ensureDockerSecretsFile();



  const devVarsPath = path.join(apiRoot, ".dev.vars");

  const fromDevVars = fs.existsSync(devVarsPath)

    ? parseDevVars(fs.readFileSync(devVarsPath, "utf8"))

    : {};



  const fromSecrets = loadSecretsOverlay();

  const secretsFile = process.env.SECRETS_FILE;

  const useDockerSecretsOnly =

    isRunningInDocker() &&

    Boolean(secretsFile) &&

    fs.existsSync(secretsFile ?? "");



  if (useDockerSecretsOnly) {

    warnOnDockerSecretKeyMismatch(fromDevVars, fromSecrets);

  }



  const devVarsForMerge = useDockerSecretsOnly

    ? omitKeys(fromDevVars, DOCKER_SECRET_KEYS)

    : fromDevVars;



  const merged: Record<string, string> = {

    ...devVarsForMerge,

    ...fromSecrets,

  };



  for (const [key, value] of Object.entries(process.env)) {

    if (value !== undefined) {

      merged[key] = value;

    }

  }



  if (merged.DATABASE_URL) {

    merged.DATABASE_URL =

      resolveDatabaseUrl(merged.DATABASE_URL) ?? merged.DATABASE_URL;

  }



  merged.LOCAL_STORAGE_PATH = resolveLocalStoragePath(merged.LOCAL_STORAGE_PATH);



  return merged;

}

