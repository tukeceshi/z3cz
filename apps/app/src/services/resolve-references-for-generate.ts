import type {
  ReferenceImageInline,
  WorkflowMediaValue,
} from "@dafthunk/types";
import { getResourceIdFromValue } from "@dafthunk/types";

import { ensureReferencesCloudForGenerate } from "@/services/ensure-references-cloud-for-generate";
import { collectResourceIds } from "@/services/ensure-resource-cached";
import { readGenerativeStagingAsInline } from "@/services/generative-media-staging";
import { resolveResourceIdsOnServer } from "@/services/resolve-resource-ids-on-server";

export type {
  ResolvedMediaReferencesForTextGenerate,
  ResolvedMediaReferencesForVideoGenerate,
  ResolvedReferencesForGenerate,
} from "./resolve-references-for-generate.types";

import type {
  ResolvedMediaReferencesForTextGenerate,
  ResolvedMediaReferencesForVideoGenerate,
  ResolvedReferencesForGenerate,
} from "./resolve-references-for-generate.types";

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("video/");
}

function isAudioMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("audio/");
}

function lookupIdForMedia(media: WorkflowMediaValue): string | null {
  return getResourceIdFromValue(media);
}

function collectLookupResourceIds(params: {
  readonly media: readonly WorkflowMediaValue[];
}): readonly string[] {
  return [
    ...new Set(
      params.media
        .map((entry) => lookupIdForMedia(entry))
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

function pushResolvedUrl(params: {
  readonly mimeType: string;
  readonly url: string;
  readonly referenceImageUrls: string[];
  readonly referenceVideoUrls: string[];
  readonly referenceAudioUrls: string[];
}): void {
  const mime = params.mimeType.toLowerCase();
  if (isVideoMimeType(mime)) {
    params.referenceVideoUrls.push(params.url);
    return;
  }
  if (isAudioMimeType(mime)) {
    params.referenceAudioUrls.push(params.url);
    return;
  }
  params.referenceImageUrls.push(params.url);
}

async function resolveStagedInline(
  media: readonly WorkflowMediaValue[]
): Promise<readonly ReferenceImageInline[]> {
  const inline: ReferenceImageInline[] = [];

  for (const ref of media) {
    const resourceId = getResourceIdFromValue(ref);
    if (!resourceId) continue;
    const payload = await readGenerativeStagingAsInline(resourceId);
    if (!payload) {
      throw new Error("Staged reference is missing from this browser");
    }
    inline.push(payload);
  }

  return inline;
}

async function resolveStagedDataUrls(
  media: readonly WorkflowMediaValue[]
): Promise<readonly string[]> {
  const urls: string[] = [];

  for (const ref of media) {
    const resourceId = getResourceIdFromValue(ref);
    if (!resourceId) continue;
    const inline = await readGenerativeStagingAsInline(resourceId);
    if (!inline) {
      throw new Error("Staged reference is missing from this browser");
    }
    urls.push(`data:${inline.mimeType};base64,${inline.data}`);
  }

  return urls;
}

async function resolveMediaGroup(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly media: readonly WorkflowMediaValue[];
  readonly cloudConfigured: boolean;
}): Promise<{
  readonly referenceImageUrls: readonly string[];
  readonly referenceImageInline: readonly ReferenceImageInline[];
  readonly referenceVideoUrls: readonly string[];
  readonly referenceAudioUrls: readonly string[];
}> {
  if (params.media.length === 0) {
    return {
      referenceImageUrls: [],
      referenceImageInline: [],
      referenceVideoUrls: [],
      referenceAudioUrls: [],
    };
  }

  const media =
    params.cloudConfigured && params.workflowId
      ? await ensureReferencesCloudForGenerate({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          media: params.media,
          cloudConfigured: true,
        })
      : params.media;

  const resourceIds = collectLookupResourceIds({
    media,
  });

  const server = await resolveResourceIdsOnServer({
    organizationId: params.organizationId,
    resourceIds,
  });

  const resolvedById = new Map(
    server.resolved
      .filter((entry) => entry.url.length > 0)
      .map((entry) => [entry.resourceId, entry])
  );

  const referenceImageUrls: string[] = [];
  const referenceVideoUrls: string[] = [];
  const referenceAudioUrls: string[] = [];
  const unresolvedMedia: WorkflowMediaValue[] = [];

  for (const entry of media) {
    const resourceId = lookupIdForMedia(entry);
    const hit = resourceId ? resolvedById.get(resourceId) : undefined;

    if (!hit) {
      unresolvedMedia.push(entry);
      continue;
    }

    pushResolvedUrl({
      mimeType: hit.mimeType || entry.mimeType || "",
      url: hit.url,
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls,
    });
  }

  if (params.cloudConfigured) {
    if (unresolvedMedia.length > 0) {
      const missing = unresolvedMedia
        .map((entry) => getResourceIdFromValue(entry))
        .filter((id): id is string => Boolean(id));
      throw new Error(
        `Unable to resolve resource references: ${missing.join(", ")}`
      );
    }

    return {
      referenceImageUrls,
      referenceImageInline: [],
      referenceVideoUrls,
      referenceAudioUrls,
    };
  }

  const images = unresolvedMedia.filter((entry) => {
    const mime = entry.mimeType ?? "";
    return !isVideoMimeType(mime) && !isAudioMimeType(mime);
  });
  const videos = unresolvedMedia.filter((entry) =>
    isVideoMimeType(entry.mimeType ?? "")
  );
  const audios = unresolvedMedia.filter((entry) =>
    isAudioMimeType(entry.mimeType ?? "")
  );

  const referenceImageInline = await resolveStagedInline(images);
  referenceVideoUrls.push(...(await resolveStagedDataUrls(videos)));
  referenceAudioUrls.push(...(await resolveStagedDataUrls(audios)));

  return {
    referenceImageUrls,
    referenceImageInline,
    referenceVideoUrls,
    referenceAudioUrls,
  };
}

export async function resolveReferencesForGenerate(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly cloudConfigured?: boolean;
  readonly references: readonly WorkflowMediaValue[];
}): Promise<ResolvedReferencesForGenerate> {
  const resolved = await resolveMediaGroup({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    media: params.references,
    cloudConfigured: params.cloudConfigured ?? false,
  });

  return {
    referenceImageUrls: resolved.referenceImageUrls,
    referenceImageInline: resolved.referenceImageInline,
  };
}

export async function resolveMediaReferencesForVideoGenerate(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly cloudConfigured?: boolean;
  readonly references: readonly WorkflowMediaValue[];
}): Promise<ResolvedMediaReferencesForVideoGenerate> {
  const resolved = await resolveMediaGroup({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    media: params.references,
    cloudConfigured: params.cloudConfigured ?? false,
  });

  return {
    referenceImageUrls: resolved.referenceImageUrls,
    referenceImageInline: resolved.referenceImageInline,
    referenceVideoUrls: resolved.referenceVideoUrls,
    referenceAudioUrls: resolved.referenceAudioUrls,
  };
}

export async function resolveMediaReferencesForTextGenerate(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly cloudConfigured?: boolean;
  readonly references: readonly WorkflowMediaValue[];
}): Promise<ResolvedMediaReferencesForTextGenerate> {
  const resolved = await resolveMediaGroup({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    media: params.references,
    cloudConfigured: params.cloudConfigured ?? false,
  });

  return {
    referenceImageUrls: resolved.referenceImageUrls,
    referenceImageInline: resolved.referenceImageInline,
    referenceVideoUrls: resolved.referenceVideoUrls,
  };
}

export function extractReferenceResourceIds(
  references: readonly WorkflowMediaValue[]
): readonly string[] {
  return collectResourceIds(references);
}
