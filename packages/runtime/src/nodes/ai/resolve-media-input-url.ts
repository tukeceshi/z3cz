import {
  isEphemeralMediaReference,
  isObjectReference,
  isResourceIdReference,
  type MediaReference,
  type ResourceIdReference,
} from "@dafthunk/types";

import type { NodeContext } from "../../node-types";

export async function resolveMediaInputUrl(
  context: NodeContext,
  ref: MediaReference | ResourceIdReference
): Promise<string> {
  if (isEphemeralMediaReference(ref)) {
    return ref.url;
  }

  if (isResourceIdReference(ref)) {
    if (!context.resolveResourceUrl) {
      throw new Error(
        "Resource URL resolution is not available for workflow media references."
      );
    }
    const url = await context.resolveResourceUrl(ref.resourceId);
    if (!url) {
      throw new Error(`Unable to resolve media resource: ${ref.resourceId}`);
    }
    return url;
  }

  if (!isObjectReference(ref)) {
    throw new Error("Unsupported media reference for URL resolution.");
  }

  if (!context.objectStore) {
    throw new Error("Object store is not available for media references.");
  }

  return context.objectStore.getPresignedUrl(ref, 3600);
}
