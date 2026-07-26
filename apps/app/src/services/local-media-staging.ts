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

import { writeGenerativeStagingWithNewId } from "@/services/generative-media-staging";

export async function storeLocalMediaBlob(params: {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly organizationId?: string;
  readonly workflowId?: string;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
}): Promise<{ readonly mediaId: string; readonly mimeType: string }> {
  const nodeType =
    params.nodeType ??
    (params.mimeType.toLowerCase().startsWith("video/")
      ? "ai-video"
      : params.mimeType.toLowerCase().startsWith("audio/")
        ? "ai-audio"
        : "ai-image");
  return writeGenerativeStagingWithNewId({
    organizationId: params.organizationId ?? "",
    workflowId: params.workflowId ?? "uploads",
    blob: params.blob,
    mimeType: params.mimeType,
    nodeType,
  });
}
