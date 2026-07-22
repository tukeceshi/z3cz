import type {
  MediaReference,
  ObjectReference,
  ReferenceImageInline,
} from "@dafthunk/types";
import {
  isCloudObjectReference,
  isEphemeralMediaReference,
  isEphemeralMediaExpired,
  isLocalMediaReference,
  isObjectReference,
} from "@dafthunk/types";

import { readLocalMediaAsInline } from "./local-media-staging";
import { makeRequest } from "./utils";

export interface ResolvedReferencesForGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
}

interface PresignDownloadResponse {
  readonly urls: readonly string[];
}

function platformAiEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

export async function resolveReferencesForGenerate(params: {
  readonly organizationId: string;
  readonly references: readonly MediaReference[];
}): Promise<ResolvedReferencesForGenerate> {
  const referenceImageUrls: string[] = [];
  const referenceImageInline: ReferenceImageInline[] = [];
  const cloudRefs: ObjectReference[] = [];

  for (const ref of params.references) {
    if (isEphemeralMediaReference(ref)) {
      if (isEphemeralMediaExpired(ref)) {
        throw new Error("Referenced ephemeral image has expired");
      }
      referenceImageUrls.push(ref.url);
      continue;
    }

    if (isLocalMediaReference(ref)) {
      const inline = await readLocalMediaAsInline(ref.mediaId);
      if (!inline) {
        throw new Error("Local reference image is missing from this browser");
      }
      referenceImageInline.push(inline);
      continue;
    }

    if (isObjectReference(ref)) {
      if (isCloudObjectReference(ref)) {
        cloudRefs.push(ref);
        continue;
      }
      throw new Error(
        "Platform object references require cloud storage for model input"
      );
    }
  }

  if (cloudRefs.length > 0) {
    const response = await makeRequest<PresignDownloadResponse>(
      `${platformAiEndpoint(params.organizationId)}/tos/presign-download`,
      {
        method: "POST",
        body: JSON.stringify({ references: cloudRefs }),
      }
    );
    referenceImageUrls.push(...response.urls);
  }

  return { referenceImageUrls, referenceImageInline };
}
