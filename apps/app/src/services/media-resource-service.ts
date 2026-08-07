import { getResourceId, isCloudObjectReference, type MediaReference } from "@dafthunk/types";
import type { RegisterMediaResourceRequest } from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

export async function registerLocalMediaResource(params: {
  readonly organizationId: string;
  readonly mediaId: string;
  readonly mimeType: string;
}): Promise<void> {
  await registerMediaResourcesBatch({
    organizationId: params.organizationId,
    resources: [
      {
        id: params.mediaId,
        kind: "local",
        mimeType: params.mimeType,
      },
    ],
  });
}

export async function registerMediaResourcesBatch(params: {
  readonly organizationId: string;
  readonly resources: readonly RegisterMediaResourceRequest[];
}): Promise<void> {
  if (params.resources.length === 0) {
    return;
  }

  try {
    await makeRequest<{ readonly registered: readonly string[] }>(
      `/${params.organizationId}/resources`,
      {
        method: "POST",
        body: JSON.stringify({ resources: params.resources }),
      }
    );
  } catch {
    // Best-effort catalog registration; local display still works from IndexedDB.
  }
}

export async function rekeyMediaResourceCatalog(params: {
  readonly organizationId: string;
  readonly fromMediaId: string;
  readonly toMediaReference: MediaReference;
}): Promise<void> {
  if (!isCloudObjectReference(params.toMediaReference)) {
    return;
  }

  const toResourceId = getResourceId(params.toMediaReference);
  if (!toResourceId || params.fromMediaId === toResourceId) {
    return;
  }

  try {
    await makeRequest<{ readonly ok: true }>(
      `/${params.organizationId}/resources/rekey`,
      {
        method: "POST",
        body: JSON.stringify({
          fromResourceId: params.fromMediaId,
          toResourceId,
          kind: "cloud",
          mimeType: params.toMediaReference.mimeType,
          storageKey: params.toMediaReference.storageKey,
        }),
      }
    );
  } catch {
    // Best-effort; canvas reconcile may retry via alias resolution.
  }
}
