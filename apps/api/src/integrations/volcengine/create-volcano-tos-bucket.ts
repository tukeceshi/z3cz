import { resolveNewVolcanoTosBucketName } from "@dafthunk/types";

import { VolcengineTosClient } from "./tos-client";
import {
  isTosBucketAlreadyOwnedError,
  isTosBucketNameUnavailableError,
  isVolcanoTosNotOpenedError,
} from "./tos-errors";

const DEFAULT_CREATE_ATTEMPTS = 5;

export async function ensureVolcanoTosBucketCreated(params: {
  readonly client: VolcengineTosClient;
  readonly bucket: string;
  readonly organizationId: string;
  readonly maxAttempts?: number;
}): Promise<string> {
  const maxAttempts = params.maxAttempts ?? DEFAULT_CREATE_ATTEMPTS;
  let bucket = params.bucket;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await params.client.createBucket(bucket);
      return bucket;
    } catch (error) {
      if (isVolcanoTosNotOpenedError(error)) {
        throw error;
      }
      if (isTosBucketAlreadyOwnedError(error)) {
        return bucket;
      }
      if (!isTosBucketNameUnavailableError(error)) {
        throw error;
      }
      if (attempt === maxAttempts - 1) {
        throw error;
      }

      const existingBuckets = await params.client.listBuckets();
      bucket = resolveNewVolcanoTosBucketName(existingBuckets, params.organizationId);
    }
  }

  return bucket;
}
