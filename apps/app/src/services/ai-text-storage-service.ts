import {
  buildAiTextExcerpt,
  inferAiTextMimeType,
  type LocalMediaReference,
  type ResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import {
  getResourceIdFromValue,
  isLocalMediaReference,
  isResourceIdReference,
} from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import {
  getCachedMediaBlob,
  type AiMediaCacheNodeType,
} from "@/services/ai-media-cache-service";
import { cloudUploadToResourceId } from "@/services/stage-generative-media";
import {
  readGenerativeStagingBlob,
  writeGenerativeStagingWithNewId,
} from "@/services/generative-media-staging";
import { resolveMediaResourceFetchUrl } from "@/services/resolve-media-resource-fetch-url";
import { uploadGenerativeMediaFromLocalStaging } from "@/services/stage-generative-media";

const AI_TEXT_NODE_TYPE: AiMediaCacheNodeType = "ai-text";

const pendingCloudUploads = new Map<string, ReturnType<typeof setTimeout>>();
const CLOUD_UPLOAD_DEBOUNCE_MS = 15_000;

export async function stageAiTextContent(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly text: string;
}): Promise<LocalMediaReference> {
  const mimeType = inferAiTextMimeType(params.text);
  const blob = new Blob([params.text], { type: mimeType });
  const { mediaId } = await writeGenerativeStagingWithNewId({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    blob,
    mimeType,
    nodeType: AI_TEXT_NODE_TYPE,
  });
  notifyAiMediaCacheChanged();
  return { kind: "local", mediaId, mimeType };
}

export async function readAiTextContent(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly value: WorkflowMediaValue | string | undefined;
}): Promise<string | null> {
  if (typeof params.value === "string") {
    return params.value;
  }
  if (!params.value) {
    return null;
  }

  const mediaId = getResourceIdFromValue(params.value);
  if (!mediaId) {
    return null;
  }

  const cached =
    (await readGenerativeStagingBlob({
      mediaId,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    })) ??
    (await getCachedMediaBlob({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId,
    }).then((blob) =>
      blob ? { blob, mimeType: params.value?.mimeType ?? "text/plain" } : null
    ));

  if (cached) {
    return cached.blob.text();
  }

  if (isResourceIdReference(params.value)) {
    const fetchUrl = await resolveMediaResourceFetchUrl({
      organizationId: params.organizationId,
      media: params.value,
    });
    if (!fetchUrl) {
      return null;
    }
    try {
      const response = await fetch(fetchUrl, { credentials: "include" });
      if (!response.ok) {
        return null;
      }
      return response.text();
    } catch {
      return null;
    }
  }

  return null;
}

export function scheduleAiTextCloudUpload(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: LocalMediaReference;
  readonly cloudConfigured: boolean;
  readonly onPromoted?: (value: ResourceIdReference) => void;
}): void {
  if (!params.cloudConfigured || !isLocalMediaReference(params.media)) {
    return;
  }

  const key = `${params.organizationId}:${params.workflowId}:${params.media.mediaId}`;
  const existing = pendingCloudUploads.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  pendingCloudUploads.set(
    key,
    setTimeout(() => {
      pendingCloudUploads.delete(key);
      void promoteAiTextLocalToCloud(params).catch((error) => {
        console.warn("[ai-text-storage] cloud upload failed", error);
      });
    }, CLOUD_UPLOAD_DEBOUNCE_MS)
  );
}

export async function promoteAiTextLocalToCloud(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: LocalMediaReference;
  readonly onPromoted?: (value: ResourceIdReference) => void;
}): Promise<ResourceIdReference | null> {
  if (!isLocalMediaReference(params.media)) {
    return null;
  }

  const object = await uploadGenerativeMediaFromLocalStaging({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: params.media.mediaId,
    mimeType: params.media.mimeType,
    mediaKind: "reference",
  });

  const resource = cloudUploadToResourceId(object);
  params.onPromoted?.(resource);
  notifyAiMediaCacheChanged();
  return resource;
}

export function buildAiTextResultExcerpt(text: string): string {
  return buildAiTextExcerpt(text);
}

export function isAiTextReferenceValue(
  value: unknown
): value is WorkflowMediaValue {
  return isLocalMediaReference(value) || isResourceIdReference(value);
}
