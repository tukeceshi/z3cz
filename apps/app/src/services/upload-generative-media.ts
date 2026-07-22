import type { LocalMediaReference, MediaReference, ObjectReference } from "@dafthunk/types";

import { makeRequest } from "./utils";
import { storeLocalMediaBlob } from "./local-media-staging";

interface TosPresignUploadResponse {
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly reference: ObjectReference;
}

function platformAiEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

export async function uploadGenerativeMedia(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly file: File;
  readonly cloudConfigured: boolean;
  readonly mediaKind?: "ai-image" | "ai-video" | "reference";
}): Promise<MediaReference> {
  const mimeType = params.file.type || "application/octet-stream";

  if (!params.cloudConfigured) {
    const { mediaId } = await storeLocalMediaBlob({
      blob: params.file,
      mimeType,
    });
    const localRef: LocalMediaReference = {
      kind: "local",
      mediaId,
      mimeType,
    };
    return localRef;
  }

  const presign = await makeRequest<TosPresignUploadResponse>(
    `${platformAiEndpoint(params.organizationId)}/tos/presign-upload`,
    {
      method: "POST",
      body: JSON.stringify({
        mimeType,
        contentLength: params.file.size,
        workflowId: params.workflowId,
        mediaKind: params.mediaKind ?? "reference",
      }),
    }
  );

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      ...presign.uploadHeaders,
      "Content-Type": mimeType,
    },
    body: params.file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Cloud upload failed (${uploadResponse.status})`);
  }

  return presign.reference;
}
