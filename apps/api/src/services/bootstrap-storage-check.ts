import type { BootstrapSettings } from "@dafthunk/types";

import type { Bindings } from "../context";
import { findNonBootstrapAccelerationObjectKeys } from "./bootstrap-r2-client";
import { listRemoteBootstrapObjectKeys } from "./bootstrap-remote-storage";

export function formatBootstrapBucketContentWarning(
  foreignKeyCount: number
): string | null {
  if (foreignKeyCount <= 0) {
    return null;
  }
  return `Warning: bucket contains ${foreignKeyCount} non-acceleration object(s). Use a dedicated bucket.`;
}

export async function inspectBootstrapBucketContent(
  settings: BootstrapSettings,
  env: Bindings
): Promise<string | null> {
  const keys = await listRemoteBootstrapObjectKeys(settings, env);
  const foreignKeys = findNonBootstrapAccelerationObjectKeys(keys);
  return formatBootstrapBucketContentWarning(foreignKeys.length);
}
