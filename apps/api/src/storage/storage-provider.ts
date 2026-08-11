import path from "node:path";

import type { BlobStore } from "./blob-store";
import { createR2BucketFromBlobStore } from "./blob-store-r2-adapter";
import {
  ensureLocalStorageRoot,
  LocalFileBlobStore,
} from "./local-file-blob-store";

export type StorageProvider = "local";

export interface ResolvedStorage {
  readonly resourcesStore: BlobStore;
  /** R2-shaped adapter for legacy call sites (workflow-store, object-store). */
  readonly RESSOURCES: R2Bucket;
  readonly provider: StorageProvider;
  readonly rootPath: string;
}

export async function createStorageBuckets(
  env: Record<string, string>
): Promise<ResolvedStorage> {
  const rootPath = path.resolve(
    env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), "data", "storage")
  );
  await ensureLocalStorageRoot(rootPath);

  const resourcesStore = new LocalFileBlobStore(
    path.join(rootPath, "ressources")
  );

  return {
    provider: "local",
    rootPath,
    resourcesStore,
    RESSOURCES: createR2BucketFromBlobStore(resourcesStore),
  };
}
