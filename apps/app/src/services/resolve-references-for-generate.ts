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

import { readGenerativeStagingAsInline } from "./generative-media-staging";
import { makeRequest } from "./utils";

export interface ResolvedReferencesForGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
}

export interface ResolvedMediaReferencesForTextGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
  readonly referenceVideoUrls: readonly string[];
}

interface PresignDownloadResponse {
  readonly urls: readonly string[];
}

function platformAiEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("video/");
}

function isAudioMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("audio/");
}

async function resolveCloudUrls(
  organizationId: string,
  cloudRefs: readonly ObjectReference[]
): Promise<readonly string[]> {
  if (cloudRefs.length === 0) {
    return [];
  }
  const response = await makeRequest<PresignDownloadResponse>(
    `${platformAiEndpoint(organizationId)}/tos/presign-download`,
    {
      method: "POST",
      body: JSON.stringify({ references: cloudRefs }),
    }
  );
  return response.urls;
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
      const inline = await readGenerativeStagingAsInline(ref.mediaId);
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

  referenceImageUrls.push(
    ...(await resolveCloudUrls(params.organizationId, cloudRefs))
  );

  return { referenceImageUrls, referenceImageInline };
}

export interface ResolvedMediaReferencesForVideoGenerate {
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
  readonly referenceVideoUrls: readonly string[];
  readonly referenceAudioUrls: readonly string[];
}

/** Resolve image / video / audio refs for video generate. */
export async function resolveMediaReferencesForVideoGenerate(params: {
  readonly organizationId: string;
  readonly references: readonly MediaReference[];
}): Promise<ResolvedMediaReferencesForVideoGenerate> {
  const images: MediaReference[] = [];
  const videos: MediaReference[] = [];
  const audios: MediaReference[] = [];

  for (const ref of params.references) {
    if (isVideoMimeType(ref.mimeType)) {
      videos.push(ref);
    } else if (isAudioMimeType(ref.mimeType)) {
      audios.push(ref);
    } else {
      images.push(ref);
    }
  }

  const imageResolved = await resolveReferencesForGenerate({
    organizationId: params.organizationId,
    references: images,
  });

  async function resolveMediaUrls(
    media: readonly MediaReference[],
    label: "video" | "audio"
  ): Promise<string[]> {
    const urls: string[] = [];
    const cloudRefs: ObjectReference[] = [];

    for (const ref of media) {
      if (isEphemeralMediaReference(ref)) {
        if (isEphemeralMediaExpired(ref)) {
          throw new Error(`Referenced ephemeral ${label} has expired`);
        }
        urls.push(ref.url);
        continue;
      }

      if (isLocalMediaReference(ref)) {
        const inline = await readGenerativeStagingAsInline(ref.mediaId);
        if (!inline) {
          throw new Error(
            `Local reference ${label} is missing from this browser`
          );
        }
        urls.push(`data:${inline.mimeType};base64,${inline.data}`);
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

    urls.push(...(await resolveCloudUrls(params.organizationId, cloudRefs)));
    return urls;
  }

  const referenceVideoUrls = await resolveMediaUrls(videos, "video");
  const referenceAudioUrls = await resolveMediaUrls(audios, "audio");

  return {
    referenceImageUrls: imageResolved.referenceImageUrls,
    referenceImageInline: imageResolved.referenceImageInline,
    referenceVideoUrls,
    referenceAudioUrls,
  };
}

/** Resolve image + video refs for multimodal text generate (Seed). */
export async function resolveMediaReferencesForTextGenerate(params: {
  readonly organizationId: string;
  readonly references: readonly MediaReference[];
}): Promise<ResolvedMediaReferencesForTextGenerate> {
  const images: MediaReference[] = [];
  const videos: MediaReference[] = [];

  for (const ref of params.references) {
    if (isVideoMimeType(ref.mimeType)) {
      videos.push(ref);
    } else {
      images.push(ref);
    }
  }

  const imageResolved = await resolveReferencesForGenerate({
    organizationId: params.organizationId,
    references: images,
  });

  const referenceVideoUrls: string[] = [];
  const cloudVideoRefs: ObjectReference[] = [];

  for (const ref of videos) {
    if (isEphemeralMediaReference(ref)) {
      if (isEphemeralMediaExpired(ref)) {
        throw new Error("Referenced ephemeral video has expired");
      }
      referenceVideoUrls.push(ref.url);
      continue;
    }

    if (isLocalMediaReference(ref)) {
      const inline = await readGenerativeStagingAsInline(ref.mediaId);
      if (!inline) {
        throw new Error("Local reference video is missing from this browser");
      }
      referenceVideoUrls.push(
        `data:${inline.mimeType};base64,${inline.data}`
      );
      continue;
    }

    if (isObjectReference(ref)) {
      if (isCloudObjectReference(ref)) {
        cloudVideoRefs.push(ref);
        continue;
      }
      throw new Error(
        "Platform object references require cloud storage for model input"
      );
    }
  }

  referenceVideoUrls.push(
    ...(await resolveCloudUrls(params.organizationId, cloudVideoRefs))
  );

  return {
    referenceImageUrls: imageResolved.referenceImageUrls,
    referenceImageInline: imageResolved.referenceImageInline,
    referenceVideoUrls,
  };
}
