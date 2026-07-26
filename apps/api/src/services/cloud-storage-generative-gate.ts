import type { Context } from "hono";

import type { ApiContext } from "../context";
import {
  CloudStorageUnhealthyError,
  isCloudStorageUnhealthyError,
} from "./classify-cloud-storage-health";

export function cloudStorageUnhealthyResponse(
  c: Context<ApiContext>,
  error: CloudStorageUnhealthyError
) {
  return c.json(
    {
      error: error.message,
      code: error.code,
      reason: error.snapshot.reason,
      health: error.snapshot,
    },
    403
  );
}

export async function runWithCloudStorageGenerativeGate<T>(
  c: Context<ApiContext>,
  organizationId: string,
  run: () => Promise<T>
): Promise<T | Response> {
  const { assertCloudStorageHealthyForGenerativeMedia } = await import(
    "./assert-cloud-storage-healthy-for-generative-media"
  );

  try {
    await assertCloudStorageHealthyForGenerativeMedia(c.env, organizationId);
  } catch (error) {
    if (isCloudStorageUnhealthyError(error)) {
      return cloudStorageUnhealthyResponse(c, error);
    }
    throw error;
  }

  return run();
}
