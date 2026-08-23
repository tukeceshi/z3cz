/**
 * @deprecated Import from `@/services/generative-media-staging` instead.
 */
export {
  blobToBase64,
  createGenerativeStagingObjectUrl as createLocalMediaObjectUrl,
  getGenerativeStagingPreviewUrl as getCachedLocalMediaPreviewUrl,
  readGenerativeStagingAsInline as readLocalMediaAsInline,
  readGenerativeStagingByMediaId as readLocalMediaBlob,
} from "@/services/generative-media-staging";

import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import { writeGenerativeStagingWithResourceId } from "@/services/generative-media-staging";

export async function storeLocalMediaBlob(params: {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly organizationId?: string;
  readonly workflowId?: string;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
}): Promise<{ readonly resourceId: string; readonly mimeType: string }> {
  const nodeType =
    params.nodeType ??
    (params.mimeType.toLowerCase().startsWith("video/")
      ? "ai-video"
      : params.mimeType.toLowerCase().startsWith("audio/")
        ? "ai-audio"
        : "ai-image");
  const resourceId = allocateGenerativeMediaResourceId();
  await writeGenerativeStagingWithResourceId({
    organizationId: params.organizationId ?? "",
    workflowId: params.workflowId ?? "uploads",
    resourceId,
    blob: params.blob,
    mimeType: params.mimeType,
    nodeType,
  });
  return { resourceId, mimeType: params.mimeType };
}
