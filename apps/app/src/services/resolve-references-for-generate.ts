import type {
  MediaReference,
  ReferenceImageInline,
} from "@dafthunk/types";
import { isLocalMediaReference } from "@dafthunk/types";

import {
  collectResourceIds,
  ensureLocalResourcesUploaded,
  filterCloudResolvableReferences,
} from "@/services/ensure-resource-cached";
import { readGenerativeStagingAsInline } from "@/services/generative-media-staging";
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

async function resolveLocalInline(
  media: readonly MediaReference[]
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
  media: readonly MediaReference[]
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
  readonly media: readonly MediaReference[];
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

  let refs = params.media;
  if (params.cloudConfigured && params.workflowId) {
    refs = await ensureLocalResourcesUploaded({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      media: params.media,
      cloudConfigured: true,
    });
  }

  const images = refs.filter((entry) => !isVideoMimeType(entry.mimeType) && !isAudioMimeType(entry.mimeType));
  const videos = refs.filter((entry) => isVideoMimeType(entry.mimeType));
  const audios = refs.filter((entry) => isAudioMimeType(entry.mimeType));

  const cloudRefs = filterCloudResolvableReferences(refs);
  const localRefs = refs.filter((entry) => isLocalMediaReference(entry));

  const server = await resolveResourceIdsOnServer({
    organizationId: params.organizationId,
    resourceIds: collectResourceIds(cloudRefs),
  });

  if (server.unresolved.length > 0 && localRefs.length === 0) {
    throw new Error(
      `Unable to resolve resource references: ${server.unresolved.join(", ")}`
    );
  }

  const referenceImageUrls: string[] = [];
  const referenceVideoUrls: string[] = [];
  const referenceAudioUrls: string[] = [];

  for (const entry of server.resolved) {
    const mime = entry.mimeType.toLowerCase();
    if (mime.startsWith("video/")) {
      referenceVideoUrls.push(entry.url);
    } else if (mime.startsWith("audio/")) {
      referenceAudioUrls.push(entry.url);
    } else {
      referenceImageUrls.push(entry.url);
    }
  }

  const referenceImageInline = await resolveLocalInline(
    images.filter((entry) => isLocalMediaReference(entry))
  );
  referenceVideoUrls.push(
    ...(await resolveLocalDataUrls(videos.filter((entry) => isLocalMediaReference(entry))))
  );
  referenceAudioUrls.push(
    ...(await resolveLocalDataUrls(audios.filter((entry) => isLocalMediaReference(entry))))
  );

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
  readonly references: readonly MediaReference[];
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
  readonly references: readonly MediaReference[];
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
  readonly references: readonly MediaReference[];
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
  references: readonly MediaReference[]
): readonly string[] {
  return collectResourceIds(references);
}
