import {
  createCosStorageBuckets,
  readCosStorageConfig,
} from "./cos-storage-provider";
import { createLocalStorageBuckets } from "./local-storage-provider";

export type { LocalStorageBuckets as StorageBuckets } from "./local-storage-provider";
export type StorageProvider = "local" | "cos";

export interface ResolvedStorage {
  RESSOURCES: R2Bucket;
  DATASETS: R2Bucket;
  INBOXES: R2Bucket;
  provider: StorageProvider;
  rootPath: string;
}

export async function createStorageBuckets(
  env: Record<string, string>
): Promise<ResolvedStorage> {
  const cosConfig = readCosStorageConfig(env);
  if (cosConfig) {
    return createCosStorageBuckets(cosConfig);
  }

  return createLocalStorageBuckets(env);
}
