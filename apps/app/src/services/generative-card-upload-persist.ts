import type { MediaReference } from "@dafthunk/types";



import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";



/** After staging, warm cache / cloud / tiers without blocking the node update. */

export function warmCardUploadPersist(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly staged: MediaReference;

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

}


