import type { ResolvedMediaResourceEntry } from "@dafthunk/types";
import { isCloudStoredResource, shouldCloudAccelerate } from "@dafthunk/types";

import { resolveMediaResourceEntry } from "@/services/resolve-media-resource-fetch-url";

export interface CloudAccelerationDecisionInput {
  readonly organizationId: string;
  readonly resourceId: string;
  readonly cloudConfigured: boolean;
  readonly interfaceInAccelList: boolean;
  readonly userTriggered?: boolean;
}

export async function shouldCloudAccelerateResource(
  params: CloudAccelerationDecisionInput
): Promise<boolean> {
  const entry = await resolveMediaResourceEntry({
    organizationId: params.organizationId,
    resourceId: params.resourceId,
  });
  if (!entry) {
    return false;
  }
  return shouldCloudAccelerate({
    resourceEntry: toCloudAccelerationSnapshot(entry),
    cloudConfigured: params.cloudConfigured,
    interfaceInAccelList: params.interfaceInAccelList,
    userTriggered: params.userTriggered,
  });
}

/** True when every resource is already in org cloud storage — download only, no upload. */
export async function areResourcesCloudStored(params: {
  readonly organizationId: string;
  readonly resourceIds: readonly string[];
}): Promise<boolean> {
  if (params.resourceIds.length === 0) {
    return false;
  }

  for (const resourceId of params.resourceIds) {
    const id = resourceId.trim();
    if (!id) {
      return false;
    }
    const entry = await resolveMediaResourceEntry({
      organizationId: params.organizationId,
      resourceId: id,
    });
    if (!entry || !isCloudStoredResource(entry)) {
      return false;
    }
  }

  return true;
}

function toCloudAccelerationSnapshot(
  entry: ResolvedMediaResourceEntry
): {
  readonly kind: string;
  readonly upstreamUrl?: string;
  readonly generating?: boolean;
  readonly expiresAt?: string;
} {
  return {
    kind: entry.kind,
    upstreamUrl: entry.upstreamUrl,
    generating: entry.generating,
    expiresAt: entry.expiresAt,
  };
}
