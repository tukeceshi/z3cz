import type {
  ReferenceImageInline,
  WorkflowMediaValue,
} from "@dafthunk/types";
import { getResourceIdFromValue, isResourceIdReference } from "@dafthunk/types";

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

function unusableReferenceError(resourceId: string): Error {
  return new Error(`Unable to resolve resource references: ${resourceId}`);
}

function assertReferenceUsableForGenerate(media: WorkflowMediaValue): void {
  if (!isResourceIdReference(media)) {
    throw new Error("Unable to resolve resource references");
  }
  if (media.generating === true || media.failed === true || media.kind == null) {
    throw unusableReferenceError(media.resourceId);
  }
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
  readonly media: readonly WorkflowMediaValue[];
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

  for (const entry of params.media) {
    assertReferenceUsableForGenerate(entry);
  }

  const cloudMedia = params.media.filter((entry) => entry.kind === "cloud");
  const stagedMedia = params.media.filter(
    (entry) => entry.kind === "local" || entry.kind === "ephemeral"
  );

  const cloudResourceIds = [
    ...new Set(
      cloudMedia
        .map((entry) => lookupIdForMedia(entry))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const server =
    cloudResourceIds.length > 0
      ? await resolveResourceIdsOnServer({
          organizationId: params.organizationId,
          resourceIds: cloudResourceIds,
        })
      : { resolved: [], unresolved: [] };

  const resolvedById = new Map(
    server.resolved
      .filter((entry) => entry.url.length > 0)
      .map((entry) => [entry.resourceId, entry])
  );

  const referenceImageUrls: string[] = [];
  const referenceVideoUrls: string[] = [];
  const referenceAudioUrls: string[] = [];
  const unresolvedStaged: WorkflowMediaValue[] = [...stagedMedia];

  for (const entry of cloudMedia) {
    const resourceId = lookupIdForMedia(entry);
    const hit = resourceId ? resolvedById.get(resourceId) : undefined;
    if (hit) {
      pushResolvedUrl({
        mimeType: hit.mimeType || entry.mimeType || "",
        url: hit.url,
        referenceImageUrls,
        referenceVideoUrls,
        referenceAudioUrls,
      });
      continue;
    }
    unresolvedStaged.push(entry);
  }

  const images = unresolvedStaged.filter((entry) => {
    const mime = entry.mimeType ?? "";
    return !isVideoMimeType(mime) && !isAudioMimeType(mime);
  });
  const videos = unresolvedStaged.filter((entry) =>
    isVideoMimeType(entry.mimeType ?? "")
  );
  const audios = unresolvedStaged.filter((entry) =>
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
    media: params.references,
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
    media: params.references,
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
    media: params.references,
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
