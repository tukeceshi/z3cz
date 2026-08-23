import type { WorkflowMediaValue } from "@dafthunk/types";
import { getResourceIdFromValue } from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";
import { generateCacheResourceTiers } from "@/services/ai-media-cache-service";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import { ensureGenerativeMediaCached } from "@/services/stage-generative-media";

async function warmDisplayTiersForStagedMedia(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly staged: WorkflowMediaValue;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<void> {
  if (params.nodeType !== "ai-image" && params.nodeType !== "ai-video") {
    return;
  }

  const mediaId = getResourceIdFromValue(params.staged);
  if (!mediaId) {
    return;
  }

  await ensureGenerativeMediaCached({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    media: params.staged,
    nodeType: params.nodeType,
  });
  await generateCacheResourceTiers({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  });
  notifyAiMediaCacheChanged();
}

/** After staging, warm cache / cloud / tiers without blocking the node update. */
export function warmCardUploadPersist(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly staged: WorkflowMediaValue;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly cloudConfigured: boolean;
}): void {
  persistMediaForNodeInBackground({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    media: [params.staged],
    nodeType: params.nodeType,
    cloudConfigured: params.cloudConfigured,
  });

  void warmDisplayTiersForStagedMedia(params).catch(() => {
    // Background warm; canvas shows loading until tiers are ready.
  });
}
