import type {
  EphemeralMediaReference,
  GenerateAiImageResponse,
  GenerationJobRecord,
  GenerationJobResultJson,
  ImageModelParameterRules,
  ReferenceImageInline,
  ResourceIdReference,
} from "@dafthunk/types";
import {
  createEphemeralMediaExpiresAt,
  isEphemeralMediaReference,
  resolveImageGenerateCount,
} from "@dafthunk/types";
import { executeVolcanoImageGeneration } from "@dafthunk/runtime/ai-interface/execute-volcano-image";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  createGenerationJob,
  updateGenerationJob,
} from "../db/generation-job-queries";
import { upsertMediaResources } from "../db/media-resource-queries";
import { finalizeAiModelInvocation } from "../db/platform-ai-model-queries";
import { createUpstreamRequestLogger } from "./create-upstream-request-logger";
import { buildReadyToPersistJobPayload } from "./generation-job-service";
import { markMediaResourcesFailed } from "./mark-media-resources-failed";
import { registerMediaResources } from "./media-resource-catalog-service";
import { syncGenerationJobInvocation } from "./sync-generation-job-invocation";

const PLACEHOLDER_IMAGE_MIME = "image/png";

export function bindEphemeralImagesToResourceIds(
  images: readonly EphemeralMediaReference[],
  resourceIds: readonly string[]
): readonly EphemeralMediaReference[] {
  return images.map((image, index) => ({
    ...image,
    mediaId: resourceIds[index] ?? image.mediaId,
  }));
}

export function buildGeneratingResourceRefs(
  resourceIds: readonly string[]
): readonly ResourceIdReference[] {
  return resourceIds.map((resourceId) => ({
    resourceId,
    mimeType: PLACEHOLDER_IMAGE_MIME,
    generating: true,
    kind: "ephemeral",
  }));
}

export function resolveCanvasImageCount(
  params: Readonly<Record<string, unknown>> | undefined,
  parameterRules: ImageModelParameterRules
): number {
  return resolveImageGenerateCount(params, parameterRules.generationFields);
}

export function buildCanvasImageGenerateResponse(params: {
  readonly job: GenerationJobRecord;
  readonly storageMode: "ephemeral" | "cloud";
  readonly requestedCount?: number;
}): GenerateAiImageResponse {
  const resourceIds =
    params.job.resultJson?.placeholderResourceIds ??
    params.job.resultJson?.pendingMedia
      ?.map((item) => item.resourceId)
      .filter((id): id is string => Boolean(id)) ??
    [];

  if (params.job.status === "succeeded") {
    return {
      images: params.job.resultJson?.finalMedia ?? [],
      invocationId: params.job.resultJson?.invocationId ?? params.job.id,
      aiInterfaceId: params.job.interfaceId,
      storageMode: params.storageMode,
      jobId: params.job.id,
      phase: "succeeded",
      resourceIds,
      requestedCount: params.requestedCount,
      requestSnapshot: params.job.resultJson?.requestSnapshot,
    };
  }

  const phase =
    params.job.status === "ready_to_persist" ||
    params.job.status === "uploading"
      ? ("ready_to_persist" as const)
      : ("generating" as const);

  return {
    images: [],
    invocationId: params.job.resultJson?.invocationId ?? params.job.id,
    aiInterfaceId: params.job.interfaceId,
    storageMode: params.storageMode,
    jobId: params.job.id,
    phase,
    resourceIds,
    requestedCount: params.requestedCount,
    requestSnapshot: params.job.resultJson?.requestSnapshot,
  };
}

export async function createCanvasImageGenerationJob(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly userId?: string | null;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly modelCanonicalId: string;
    readonly interfaceId: string;
    readonly requestedCount: number;
    readonly clientRequestId?: string | null;
    readonly invocationId: string;
  }
): Promise<{
  readonly job: GenerationJobRecord;
  readonly resourceIds: readonly string[];
}> {
  const resourceIds = Array.from({ length: params.requestedCount }, () =>
    crypto.randomUUID()
  );

  await registerMediaResources(db, {
    organizationId: params.organizationId,
    resources: resourceIds.map((id) => ({
      id,
      kind: "ephemeral" as const,
      mimeType: PLACEHOLDER_IMAGE_MIME,
      generating: true,
    })),
  });

  const resultJson: GenerationJobResultJson = {
    placeholderResourceIds: resourceIds,
    aiInterfaceId: params.interfaceId,
    invocationId: params.invocationId,
  };

  const job = await createGenerationJob(db, {
    id: params.id,
    organizationId: params.organizationId,
    userId: params.userId,
    workflowId: params.workflowId,
    nodeId: params.nodeId,
    modality: "image",
    status: "generating",
    modelCanonicalId: params.modelCanonicalId,
    interfaceId: params.interfaceId,
    resultJson,
    clientRequestId: params.clientRequestId,
  });

  return { job, resourceIds };
}

async function markResourcesFailed(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resourceIds: readonly string[];
  }
): Promise<void> {
  await markMediaResourcesFailed(db, {
    organizationId: params.organizationId,
    resourceIds: params.resourceIds,
    mimeType: PLACEHOLDER_IMAGE_MIME,
  });
}

export async function runCanvasImageGenerationJob(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly jobId: string;
  readonly invocationId: string;
  readonly resourceIds: readonly string[];
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly providerModelId: string;
  readonly prompt: string;
  readonly parameterRules: ImageModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly workflowId?: string;
  readonly interfaceId: string;
  readonly useFullSubmitUrl?: boolean;
  readonly storageMode: "ephemeral" | "cloud";
}): Promise<void> {
  const db = createDatabase(params.env);
  try {
  const upstreamLog = createUpstreamRequestLogger(db, {
    organizationId: params.organizationId,
    interfaceId: params.interfaceId,
    invocationId: params.invocationId,
    generationJobId: params.jobId,
    operation: "submit",
  });

  const result = await executeVolcanoImageGeneration({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    providerModelId: params.providerModelId,
    prompt: params.prompt,
    parameterRules: params.parameterRules,
    generationParams: params.generationParams,
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
    storageMode: "ephemeral",
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    upstreamLog,
    useFullSubmitUrl: params.useFullSubmitUrl,
  });

  if (result.status === "failed") {
    await markResourcesFailed(db, {
      organizationId: params.organizationId,
      resourceIds: params.resourceIds,
    });
    await updateGenerationJob(db, {
      id: params.jobId,
      organizationId: params.organizationId,
      status: "failed",
      expectedStatuses: ["generating"],
      failureReason: result.error ?? "Generation failed",
    });
    await finalizeAiModelInvocation(db, {
      id: params.invocationId,
      organizationId: params.organizationId,
      status: "failed",
      error: result.error ?? "Generation failed",
    });
    return;
  }

  const ephemeralImages = (result.images ?? []).filter(isEphemeralMediaReference);
  if (ephemeralImages.length === 0) {
    await markResourcesFailed(db, {
      organizationId: params.organizationId,
      resourceIds: params.resourceIds,
    });
    await updateGenerationJob(db, {
      id: params.jobId,
      organizationId: params.organizationId,
      status: "failed",
      expectedStatuses: ["generating"],
      failureReason: "Expected ephemeral upstream image URLs",
    });
    await finalizeAiModelInvocation(db, {
      id: params.invocationId,
      organizationId: params.organizationId,
      status: "failed",
      error: "Expected ephemeral upstream image URLs",
    });
    return;
  }

  const boundImages = bindEphemeralImagesToResourceIds(
    ephemeralImages,
    params.resourceIds
  );
  const unusedIds = params.resourceIds.slice(boundImages.length);
  const expiresAt = createEphemeralMediaExpiresAt();

  await upsertMediaResources(db, [
    ...boundImages.map((image) => ({
      id: image.mediaId,
      organizationId: params.organizationId,
      kind: "ephemeral" as const,
      mimeType: image.mimeType,
      upstreamUrl: image.url,
      expiresAt: image.expiresAt ?? expiresAt,
      generating: false,
      failed: false,
    })),
    ...unusedIds.map((id) => ({
      id,
      organizationId: params.organizationId,
      kind: "ephemeral" as const,
      mimeType: PLACEHOLDER_IMAGE_MIME,
      generating: false,
      failed: false,
    })),
  ]);

  const usedResourceIds = boundImages.map((image) => image.mediaId);

  if (params.storageMode === "cloud") {
    const { readyAt, resultJson } = buildReadyToPersistJobPayload({
      images: boundImages,
      mediaKind: "ai-image",
      aiInterfaceId: params.interfaceId,
      invocationId: params.invocationId,
      requestSnapshot: result.requestSnapshot,
    });
    const updated = await updateGenerationJob(db, {
      id: params.jobId,
      organizationId: params.organizationId,
      status: "ready_to_persist",
      expectedStatuses: ["generating"],
      readyAt,
      resultJson: {
        ...resultJson,
        placeholderResourceIds: usedResourceIds,
      },
    });
    if (updated) {
      await syncGenerationJobInvocation(db, updated);
    }
    return;
  }

  const updated = await updateGenerationJob(db, {
    id: params.jobId,
    organizationId: params.organizationId,
    status: "succeeded",
    expectedStatuses: ["generating"],
    resultJson: {
      placeholderResourceIds: usedResourceIds,
      finalMedia: boundImages,
      invocationId: params.invocationId,
      requestSnapshot: result.requestSnapshot,
    },
  });
  await finalizeAiModelInvocation(db, {
    id: params.invocationId,
    organizationId: params.organizationId,
    status: "completed",
    content: `${boundImages.length} image(s)`,
    error: null,
  });
  if (updated) {
    await syncGenerationJobInvocation(db, updated);
  }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed";
    await markResourcesFailed(db, {
      organizationId: params.organizationId,
      resourceIds: params.resourceIds,
    });
    await updateGenerationJob(db, {
      id: params.jobId,
      organizationId: params.organizationId,
      status: "failed",
      expectedStatuses: ["generating"],
      failureReason: message,
    });
    await finalizeAiModelInvocation(db, {
      id: params.invocationId,
      organizationId: params.organizationId,
      status: "failed",
      error: message,
    });
  }
}

export function readPlaceholderResourceIds(
  job: GenerationJobRecord
): readonly string[] {
  return (
    job.resultJson?.placeholderResourceIds ??
    job.resultJson?.pendingMedia
      ?.map((item) => item.resourceId)
      .filter((id): id is string => Boolean(id)) ??
    []
  );
}
