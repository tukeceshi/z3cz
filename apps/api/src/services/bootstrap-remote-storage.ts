import type { BootstrapManifest, BootstrapSettings } from "@dafthunk/types";

import type { Bindings } from "../context";
import {
  BOOTSTRAP_REMOTE_MANIFEST_KEY,
  BootstrapR2Credentials,
  buildBootstrapR2ObjectKey,
  deleteBootstrapObjectFromR2,
  getBootstrapObjectFromR2,
  listBootstrapBucketObjectKeys,
  uploadBootstrapShellToR2,
} from "./bootstrap-r2-client";
import { getBootstrapStorageProvider, resolveBootstrapR2SecretAccessKey } from "./bootstrap-settings";
import { createBootstrapTosClient } from "./bootstrap-storage-sources";
import { parseRemoteBootstrapManifest } from "./bootstrap-sync-plan";

async function resolveR2Credentials(
  settings: BootstrapSettings,
  env: Bindings
): Promise<BootstrapR2Credentials> {
  const secretAccessKey = await resolveBootstrapR2SecretAccessKey(settings, env);
  return {
    accountId: settings.accountId,
    accessKeyId: settings.accessKeyId,
    secretAccessKey,
    bucketName: settings.bucketName,
  };
}

export async function fetchRemoteBootstrapManifest(
  settings: BootstrapSettings,
  env: Bindings
): Promise<BootstrapManifest | null> {
  if (getBootstrapStorageProvider(settings) === "tos") {
    const client = await createBootstrapTosClient(settings, env);
    const result = await client.tryGetObject({
      key: BOOTSTRAP_REMOTE_MANIFEST_KEY,
    });
    if (!result) {
      return null;
    }
    return parseRemoteBootstrapManifest(result.data);
  }

  const credentials = await resolveR2Credentials(settings, env);
  const body = await getBootstrapObjectFromR2({
    credentials,
    key: BOOTSTRAP_REMOTE_MANIFEST_KEY,
  });
  if (!body) {
    return null;
  }
  return parseRemoteBootstrapManifest(body);
}

export async function putRemoteBootstrapManifest(
  settings: BootstrapSettings,
  env: Bindings,
  manifest: BootstrapManifest
): Promise<void> {
  const body = new TextEncoder().encode(`${JSON.stringify(manifest)}\n`);

  if (getBootstrapStorageProvider(settings) === "tos") {
    const client = await createBootstrapTosClient(settings, env);
    await client.putObject({
      key: BOOTSTRAP_REMOTE_MANIFEST_KEY,
      body,
      mimeType: "application/json",
    });
    return;
  }

  const credentials = await resolveR2Credentials(settings, env);
  await uploadBootstrapShellToR2({
    credentials,
    key: BOOTSTRAP_REMOTE_MANIFEST_KEY,
    body,
    contentType: "application/json",
  });
}

export async function deleteRemoteBootstrapObject(
  settings: BootstrapSettings,
  env: Bindings,
  key: string
): Promise<void> {
  if (getBootstrapStorageProvider(settings) === "tos") {
    const client = await createBootstrapTosClient(settings, env);
    await client.deleteObject({ key });
    return;
  }

  const credentials = await resolveR2Credentials(settings, env);
  await deleteBootstrapObjectFromR2({ credentials, key });
}

export async function listRemoteBootstrapObjectKeys(
  settings: BootstrapSettings,
  env: Bindings
): Promise<readonly string[]> {
  if (getBootstrapStorageProvider(settings) === "tos") {
    const client = await createBootstrapTosClient(settings, env);
    return client.listObjectKeys();
  }

  const credentials = await resolveR2Credentials(settings, env);
  return listBootstrapBucketObjectKeys(credentials);
}

export { buildBootstrapR2ObjectKey };
