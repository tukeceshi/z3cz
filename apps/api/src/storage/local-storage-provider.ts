import path from "node:path";

import {
  ensureLocalStorageRoot,
  LocalR2Bucket,
} from "./local-r2-bucket";

export interface LocalStorageBuckets {
  RESSOURCES: R2Bucket;
  DATASETS: R2Bucket;
  INBOXES: R2Bucket;
  provider: "local";
  rootPath: string;
}

export async function createLocalStorageBuckets(
  env: Record<string, string>
): Promise<LocalStorageBuckets> {
  const rootPath = path.resolve(
    env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), "data", "storage")
  );
  await ensureLocalStorageRoot(rootPath);

  return {
    provider: "local",
    rootPath,
    RESSOURCES: new LocalR2Bucket(path.join(rootPath, "ressources")),
    DATASETS: new LocalR2Bucket(path.join(rootPath, "datasets")),
    INBOXES: new LocalR2Bucket(path.join(rootPath, "inboxes")),
  };
}
