import {
  buildAiTextExcerpt,
  inferAiTextMimeType,
  type PatchNodeLayoutMetadata,
  type ResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import {
  getResourceIdFromValue,
  isResourceIdReference,
} from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import {
  getCachedMediaBlob,
  type AiMediaCacheNodeType,
} from "@/services/ai-media-cache-service";
import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import {
  readGenerativeStagingBlob,
  writeGenerativeStaging,
} from "@/services/generative-media-staging";

const AI_TEXT_NODE_TYPE: AiMediaCacheNodeType = "ai-text";

export async function stageAiTextContent(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly text: string;
  readonly mediaId?: string;
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<ResourceIdReference> {
  const mimeType = inferAiTextMimeType(params.text);
  const blob = new Blob([params.text], { type: mimeType });
  const resourceId = params.mediaId?.trim() || allocateGenerativeMediaResourceId();
  await writeGenerativeStaging({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    mediaId: resourceId,
    blob,
    mimeType,
    nodeType: AI_TEXT_NODE_TYPE,
    patchNodeLayout: params.patchNodeLayout,
  });
  notifyAiMediaCacheChanged();
  return { resourceId, mimeType };
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

  const mimeType = params.value.mimeType ?? "text/plain";
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
    }).then((blob) => (blob ? { blob, mimeType } : null)));

  if (cached) {
    return cached.blob.text();
  }

  return null;
}

export function buildAiTextResultExcerpt(text: string): string {
  return buildAiTextExcerpt(text);
}

export function isAiTextReferenceValue(
  value: unknown
): value is WorkflowMediaValue {
  return isResourceIdReference(value);
}
