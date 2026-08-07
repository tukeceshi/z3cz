import type { MediaReference, RegisterMediaResourceRequest } from "@dafthunk/types";
import {
  getResourceId,
  isCloudObjectReference,
  isEphemeralMediaReference,
  isLocalMediaReference,
  isObjectReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { collectAllWorkflowMediaReferences } from "@/services/collect-workflow-media-references";
import { registerMediaResourcesBatch } from "@/services/media-resource-service";

function mediaReferenceToCatalogRegisterRequest(
  ref: MediaReference
): RegisterMediaResourceRequest | null {
  if (isLocalMediaReference(ref)) {
    return {
      id: ref.mediaId,
      kind: "local",
      mimeType: ref.mimeType,
    };
  }

  if (isEphemeralMediaReference(ref)) {
    return {
      id: ref.mediaId,
      kind: "ephemeral",
      mimeType: ref.mimeType,
    };
  }

  if (isObjectReference(ref) && isCloudObjectReference(ref)) {
    return {
      id: getResourceId(ref),
      kind: "cloud",
      mimeType: ref.mimeType,
      storageKey: ref.storageKey,
    };
  }

  return null;
}

/** Best-effort catalog registration for testing — does not touch IndexedDB or thumbnails. */
export function syncWorkflowMediaResourcesToCatalog(params: {
  readonly organizationId: string;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}): void {
  const media = collectAllWorkflowMediaReferences(params.nodes);
  const seen = new Set<string>();
  const resources: RegisterMediaResourceRequest[] = [];

  for (const item of media) {
    const request = mediaReferenceToCatalogRegisterRequest(item);
    if (!request || seen.has(request.id)) {
      continue;
    }
    seen.add(request.id);
    resources.push(request);
  }

  if (resources.length === 0) {
    return;
  }

  void registerMediaResourcesBatch({
    organizationId: params.organizationId,
    resources,
  });
}
