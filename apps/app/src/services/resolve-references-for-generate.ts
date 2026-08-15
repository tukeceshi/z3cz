import type {
  ReferenceImageInline,
  WorkflowMediaValue,
} from "@dafthunk/types";
import { getResourceIdFromValue, isLocalMediaReference } from "@dafthunk/types";

import { collectResourceIds } from "@/services/ensure-resource-cached";
import { readGenerativeStagingAsInline } from "@/services/generative-media-staging";
import { resolveCanonicalResourceId } from "@/services/media-resource-alias-service";
import { makeRequest } from "@/services/utils";

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

interface ResolveResourceRefsResponse {
  readonly resolved: readonly {
    readonly resourceId: string;
    readonly url: string;
    readonly mimeType: string;
  }[];
  readonly unresolved: readonly string[];
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

async function resolveResourceIdsOnServer(params: {
  readonly organizationId: string;
  readonly resourceIds: readonly string[];
}): Promise<ResolveResourceRefsResponse> {
  if (params.resourceIds.length === 0) {
    return { resolved: [], unresolved: [] };
  }

  return makeRequest<ResolveResourceRefsResponse>(
    `${platformAiEndpoint(params.organizationId)}/resolve-resource-refs`,
    {
      method: "POST",
      body: JSON.stringify({ resourceIds: params.resourceIds }),
    }
  );
}

function lookupIdsForMedia(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId?: string;
}): readonly string[] {
  const id = getResourceIdFromValue(params.media);
  const ids: string[] = id ? [id] : [];
  if (!params.workflowId) {
    return ids;
  }

  const canonical = resolveCanonicalResourceId({
    media: params.media,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  if (canonical && !ids.includes(canonical)) {
    ids.push(canonical);
  }
  return ids;
}

function collectLookupResourceIds(params: {
  readonly media: readonly WorkflowMediaValue[];
  readonly organizationId: string;
  readonly workflowId?: string;
}): readonly string[] {
  return [
    ...new Set(
      params.media.flatMap((entry) =>
        lookupIdsForMedia({
          media: entry,
          organizationId: params.organizationId,
          workflowId: params.workflowId,
        })
      )
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

async function resolveLocalInline(
  media: readonly WorkflowMediaValue[]
): Promise<readonly ReferenceImageInline[]> {
  const inline: ReferenceImageInline[] = [];

  for (const ref of media) {
    if (!isLocalMediaReference(ref)) continue;
    const payload = await readGenerativeStagingAsInline(ref.mediaId);
    if (!payload) {
      throw new Error("Local reference is missing from this browser");
    }
    inline.push(payload);
  }

  return inline;
}

async function resolveLocalDataUrls(
  media: readonly WorkflowMediaValue[]
): Promise<readonly string[]> {
  const urls: string[] = [];

  for (const ref of media) {
    if (!isLocalMediaReference(ref)) continue;
    const inline = await readGenerativeStagingAsInline(ref.mediaId);
    if (!inline) {
      throw new Error("Local reference is missing from this browser");
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

  const resourceIds = collectLookupResourceIds({
    media: params.media,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
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

  for (const entry of params.media) {
    const ids = lookupIdsForMedia({
      media: entry,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
    const hit = ids
      .map((id) => resolvedById.get(id))
      .find((resolved) => resolved !== undefined);

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

  const referenceImageInline = await resolveLocalInline(images);
  referenceVideoUrls.push(...(await resolveLocalDataUrls(videos)));
  referenceAudioUrls.push(...(await resolveLocalDataUrls(audios)));

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
