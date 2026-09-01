import {
  applyVideoRetakeEditOverrides,
  getResourceIdFromValue,
  isAiVideoRetakePanel,
  splitVideoRetakeSegments,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
  type MediaReference,
  type ReferenceImageInline,
  type VideoRetakeSegment,
  type VideoTrimRangeSec,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import type { TranslationKey } from "@/i18n";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import {
  buildMediaProxyEndpoint,
  mediaFetchInitForCacheUrl,
  mediaUrlSupportsBrowserCache,
} from "@/services/media-cache-fetch-utils";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";
import {
  getGenerationJob,
  submitVideoConcat,
  submitVideoTrim,
} from "@/services/platform-ai-model-service";
import { resolveMediaReferencesForVideoGenerate } from "@/services/resolve-references-for-generate";
import { stageGenerativeCardUpload, uploadGenerativeMediaFile } from "@/services/stage-generative-media";

import {
  appendAiVideoGeneratedHistoryItems,
  withAiVideoGenerateError,
  withAiVideoGeneratingFlag,
  withAiVideoGeneratingHistoryFailed,
  withAiVideoManualUpload,
} from "./ai-video-node-utils";
import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import { withGenerativeBottomPanelHidden } from "./generative-card-mode-utils";
import {
  isGenerativeGenerationCancelled,
  isNodeGenerationCancelled,
  resetNodeGenerationCancelled,
  showGenerativeCancelledNotice,
} from "./generative-generation-cancel";
import { REF_SUPPORTS_TASK_CANCEL_META_KEY } from "./generative-reference-metadata";
import {
  clearGenerativeProgress,
  readGenerativeProgressJobId,
  withGenerativeProgress,
  withGenerativeUploadProgress,
  type GenerativeProgressPhase,
} from "./generative-progress-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { resolveGenerativeCardUploadError } from "./generative-card-upload-utils";
import {
  resolveAiVideoJobMedia,
  runAiVideoGeneration,
  type RunAiVideoGenerationResult,
} from "./run-ai-video-generation";
import { concatVideoLocally } from "./video-concat-local";
import { trimVideoLocally } from "./video-trim-local";
import { withRetakeGenerationComplete } from "./ai-video-retake-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

type UpdateNodeDataFn = (
  nodeId: string,
  updater: (current: WorkflowNodeType) => Partial<WorkflowNodeType>
) => void;

type TranslateFn = (
  key: TranslationKey,
  values?: Record<string, string | number>
) => string;

interface AppToast {
  readonly error: (key: TranslationKey) => void;
  readonly errorRaw: (message: string) => void;
  readonly success: (key: TranslationKey) => void;
}

function isCloudSourceMedia(media: MediaReference): boolean {
  if (!("kind" in media)) {
    return false;
  }
  return (media as { readonly kind?: string }).kind === "cloud";
}

export interface RunVideoRetakePipelineParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly targetNodeId: string;
  readonly sourceMedia: MediaReference;
  readonly trimSourceVideoUrl: string;
  readonly committedRange: VideoTrimRangeSec;
  readonly videoDurationSec: number;
  readonly highQuality: boolean;
  readonly mediaKitInterfaceId: string | null;
  readonly cloudConfigured: boolean;
  readonly prompt: string;
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly instanceId?: string;
  readonly modelDisplayName?: string;
  readonly supportsTaskCancel: boolean;
  readonly generationParams: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly referenceAudioUrls?: readonly string[];
  readonly skipStitch: boolean;
  readonly updateNodeData: UpdateNodeDataFn;
  readonly uploadVideoFileToNode: (params: {
    readonly nodeId: string;
    readonly file: File;
  }) => Promise<void>;
  readonly t: TranslateFn;
  readonly toast: AppToast;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Trim clip first, then canvas video refs; skip empty and duplicate URLs. */
export function mergeRetakeReferenceVideoUrls(
  trimClipUrl: string,
  canvasVideoUrls?: readonly string[]
): readonly string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const append = (url: string) => {
    const normalized = url.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    merged.push(normalized);
  };

  append(trimClipUrl);
  for (const url of canvasVideoUrls ?? []) {
    append(url);
  }

  return merged;
}

function findRetakeSegmentIndex(
  segments: readonly VideoRetakeSegment[]
): number {
  const index = segments.findIndex((segment) => segment.role === "retake");
  if (index < 0) {
    throw new Error("Retake segment is missing");
  }
  return index;
}

function withRetakeGenerateMetadata(
  metadata: Record<string, string> | undefined,
  params: {
    readonly jobId?: string;
    readonly phase: GenerativeProgressPhase;
    readonly supportsTaskCancel: boolean;
  }
): Record<string, string> {
  const next = withGenerativeProgress(
    withAiVideoGeneratingFlag(metadata, true),
    { phase: params.phase, jobId: params.jobId }
  );
  if (!params.supportsTaskCancel) {
    return next;
  }
  return {
    ...next,
    [REF_SUPPORTS_TASK_CANCEL_META_KEY]: "1",
  };
}

function clearRetakeBusyMetadata(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  return withAiVideoGeneratingFlag(clearGenerativeProgress(metadata), false);
}

function finalizeRetakeNode(
  current: WorkflowNodeType,
  patch: Partial<WorkflowNodeType>
): Partial<WorkflowNodeType> {
  const merged = { ...current, ...patch };
  const withPreview = withRetakeGenerationComplete(merged);
  return {
    ...merged,
    ...withPreview,
    metadata: clearRetakeBusyMetadata(withPreview.metadata ?? merged.metadata),
  };
}

function markTargetBusy(params: {
  readonly updateNodeData: UpdateNodeDataFn;
  readonly targetNodeId: string;
  readonly supportsTaskCancel: boolean;
  readonly jobId?: string;
  readonly phase?: GenerativeProgressPhase;
}): void {
  params.updateNodeData(params.targetNodeId, (current) => ({
    metadata: withRetakeGenerateMetadata(current.metadata, {
      jobId: params.jobId,
      phase: params.phase ?? "generating",
      supportsTaskCancel: params.supportsTaskCancel,
    }),
  }));
}

function markTargetCancelled(params: {
  readonly updateNodeData: UpdateNodeDataFn;
  readonly targetNodeId: string;
}): void {
  params.updateNodeData(params.targetNodeId, (current) => ({
    metadata: withAiVideoGenerateError(
      clearRetakeBusyMetadata(current.metadata),
      null
    ),
  }));
  showGenerativeCancelledNotice(params.targetNodeId);
}

function markTargetFailed(params: {
  readonly updateNodeData: UpdateNodeDataFn;
  readonly targetNodeId: string;
  readonly t: TranslateFn;
  readonly toast: AppToast;
  readonly error: unknown;
}): void {
  const formatted = prepareGenerativeCardError(
    params.error instanceof Error
      ? params.error.message
      : params.t("workflow.videoRetake.generateFailed"),
    params.t,
    "video"
  );
  params.updateNodeData(params.targetNodeId, (current) => ({
    ...withAiVideoGeneratingHistoryFailed(
      current,
      readGenerativeProgressJobId(current.metadata)
    ),
    metadata: withAiVideoGenerateError(
      withGenerativeBottomPanelHidden(clearRetakeBusyMetadata(current.metadata)),
      formatted
    ),
  }));
  params.toast.errorRaw(formatted.summary);
}

async function waitForJobSourceUrl(
  organizationId: string,
  jobId: string
): Promise<string> {
  while (true) {
    const response = await getGenerationJob(organizationId, jobId);
    if (response.job.status === "failed") {
      throw new Error(response.job.failureReason ?? "Video job failed");
    }
    if (response.job.status === "cancelled") {
      throw new Error("Video job cancelled");
    }
    const sourceUrl = response.pendingMedia?.[0]?.sourceUrl?.trim();
    if (sourceUrl) {
      return sourceUrl;
    }
    await sleep(VIDEO_JOB_CLIENT_POLL_INTERVAL_MS);
  }
}

async function writeCloudResultToNode(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly targetNodeId: string;
  readonly jobId: string;
  readonly cloudConfigured: boolean;
  readonly updateNodeData: UpdateNodeDataFn;
  readonly toast: AppToast;
}): Promise<void> {
  const resolved = await resolveAiVideoJobMedia({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    jobId: params.jobId,
    cloudConfigured: params.cloudConfigured,
    onProgressPhase: (phase) => {
      params.updateNodeData(params.targetNodeId, (current) => ({
        metadata: withGenerativeProgress(
          withAiVideoGeneratingFlag(current.metadata, true),
          { jobId: params.jobId, phase }
        ),
      }));
    },
  });
  if (resolved.media.length === 0) {
    throw new Error("Video retake produced no media");
  }

  const canWriteHistory = tryClaimGenerativeJobFinalize(params.jobId);
  if (canWriteHistory) {
    persistMediaForNodeInBackground({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      media: resolved.media,
      nodeType: "ai-video",
      cloudConfigured: params.cloudConfigured,
    });
  }

  params.updateNodeData(params.targetNodeId, (current) => {
    if (!canWriteHistory) {
      return {
        metadata: withAiVideoGenerateError(
          clearRetakeBusyMetadata(current.metadata),
          null
        ),
      };
    }

    const withMedia = isAiVideoRetakePanel(current.metadata)
      ? appendAiVideoGeneratedHistoryItems(
          current,
          resolved.media as unknown as WorkflowMediaValue[],
          {
            prompt:
              typeof current.inputs.find((input) => input.id === "prompt")?.value ===
              "string"
                ? current.inputs.find((input) => input.id === "prompt")!.value
                : "",
          }
        )
      : withAiVideoManualUpload(
          current,
          resolved.media as unknown as readonly MediaReference[]
        );
    const merged = { ...current, ...withMedia };
    const finalized = finalizeRetakeNode(merged, {});
    return {
      ...finalized,
      metadata: withAiVideoGenerateError(finalized.metadata, null),
    };
  });

  if (canWriteHistory) {
    params.toast.success("workflow.aiVideoPanel.generated");
  }
}

function writeGeneratedVideoToNode(params: {
  readonly pipeline: RunVideoRetakePipelineParams;
  readonly generated: RunAiVideoGenerationResult;
}): void {
  const video = params.generated.video;
  if (!video) {
    throw new Error("Video generation succeeded without a playable reference");
  }
  const jobId = params.generated.jobId;
  const canWriteHistory = jobId
    ? tryClaimGenerativeJobFinalize(jobId)
    : true;
  if (canWriteHistory) {
    persistMediaForNodeInBackground({
      organizationId: params.pipeline.organizationId,
      workflowId: params.pipeline.workflowId,
      media: [video as unknown as WorkflowMediaValue],
      nodeType: "ai-video",
      cloudConfigured: params.pipeline.cloudConfigured,
    });
  }

  params.pipeline.updateNodeData(params.pipeline.targetNodeId, (current) => {
    if (!canWriteHistory) {
      return {
        metadata: withAiVideoGenerateError(
          clearRetakeBusyMetadata(current.metadata),
          null
        ),
      };
    }
    const withResult = appendAiVideoGeneratedHistoryItems(
      current,
      [video as unknown as WorkflowMediaValue],
      {
      prompt: params.pipeline.prompt,
      params: params.pipeline.generationParams,
      platformModelId: params.pipeline.modelCanonicalId,
      aiInterfaceId: params.generated.aiInterfaceId,
      modelDisplayName: params.pipeline.modelDisplayName,
      jobId: jobId ?? undefined,
    });
    const merged = { ...current, ...withResult };
    const finalized = finalizeRetakeNode(merged, withResult);
    return {
      ...finalized,
      metadata: withAiVideoGenerateError(finalized.metadata, null),
    };
  });

  if (canWriteHistory) {
    params.pipeline.toast.success("workflow.aiVideoPanel.generated");
  }
}

async function generateRetakeClip(params: {
  readonly pipeline: RunVideoRetakePipelineParams;
  readonly referenceVideoUrl: string;
}): Promise<RunAiVideoGenerationResult> {
  const generationParams = applyVideoRetakeEditOverrides(
    params.pipeline.generationParams
  );
  return runAiVideoGeneration({
    organizationId: params.pipeline.organizationId,
    workflowId: params.pipeline.workflowId,
    body: {
      modelCanonicalId: params.pipeline.modelCanonicalId,
      aiInterfaceId: params.pipeline.aiInterfaceId,
      ...(params.pipeline.instanceId
        ? { instanceId: params.pipeline.instanceId }
        : {}),
      prompt: params.pipeline.prompt,
      params: generationParams,
      referenceVideoUrls: mergeRetakeReferenceVideoUrls(
        params.referenceVideoUrl,
        params.pipeline.referenceVideoUrls
      ),
      ...(params.pipeline.referenceImageUrls &&
      params.pipeline.referenceImageUrls.length > 0
        ? { referenceImageUrls: params.pipeline.referenceImageUrls }
        : {}),
      ...(params.pipeline.referenceImageInline &&
      params.pipeline.referenceImageInline.length > 0
        ? { referenceImageInline: params.pipeline.referenceImageInline }
        : {}),
      ...(params.pipeline.referenceAudioUrls &&
      params.pipeline.referenceAudioUrls.length > 0
        ? { referenceAudioUrls: params.pipeline.referenceAudioUrls }
        : {}),
      workflowId: params.pipeline.workflowId,
      nodeId: params.pipeline.targetNodeId,
      clientRequestId: crypto.randomUUID(),
    },
    shouldAbort: () => isNodeGenerationCancelled(params.pipeline.targetNodeId),
    onPhase: (phase, jobId) => {
      markTargetBusy({
        updateNodeData: params.pipeline.updateNodeData,
        targetNodeId: params.pipeline.targetNodeId,
        supportsTaskCancel: params.pipeline.supportsTaskCancel,
        jobId,
        phase,
      });
    },
    applySubmitToNode: (response) => {
      params.pipeline.updateNodeData(
        params.pipeline.targetNodeId,
        (current) => ({
          ...(response.workflowNodeContent
            ? applyWorkflowNodeContentPatch(
                current,
                response.workflowNodeContent
              )
            : {}),
          metadata: withRetakeGenerateMetadata(current.metadata, {
            jobId: response.jobId,
            phase: "generating",
            supportsTaskCancel: params.pipeline.supportsTaskCancel,
          }),
        })
      );
    },
    resolveJobMedia: (jobId) =>
      resolveAiVideoJobMedia({
        organizationId: params.pipeline.organizationId,
        workflowId: params.pipeline.workflowId,
        jobId,
        cloudConfigured: params.pipeline.cloudConfigured,
        shouldAbort: () =>
          isNodeGenerationCancelled(params.pipeline.targetNodeId),
        onProgressPhase: (phase) => {
          markTargetBusy({
            updateNodeData: params.pipeline.updateNodeData,
            targetNodeId: params.pipeline.targetNodeId,
            supportsTaskCancel: params.pipeline.supportsTaskCancel,
            jobId,
            phase,
          });
        },
      }),
  });
}

async function resolveGeneratedMediaUrl(params: {
  readonly pipeline: RunVideoRetakePipelineParams;
  readonly video: MediaReference;
}): Promise<string> {
  const resolved = await resolveMediaReferencesForVideoGenerate({
    organizationId: params.pipeline.organizationId,
    workflowId: params.pipeline.workflowId,
    cloudConfigured: params.pipeline.cloudConfigured,
    references: [params.video as unknown as WorkflowMediaValue],
  });
  const url = resolved.referenceVideoUrls[0]?.trim();
  if (!url) {
    throw new Error("Unable to resolve generated retake video");
  }
  return url;
}

async function fetchVideoBlob(params: {
  readonly organizationId: string;
  readonly url: string;
}): Promise<Blob> {
  const url = params.url.trim();
  const fetchUrl =
    url.startsWith("data:") || mediaUrlSupportsBrowserCache(url)
      ? url
      : buildMediaProxyEndpoint(params.organizationId, url, "video/mp4");
  const response = await fetch(
    fetchUrl,
    url.startsWith("data:") ? undefined : mediaFetchInitForCacheUrl(fetchUrl)
  );
  if (!response.ok) {
    throw new Error(`fetch_generated_video_${response.status}`);
  }
  return response.blob();
}

async function resolveLocalRetakeReferenceUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly cloudConfigured: boolean;
  readonly blob: Blob;
}): Promise<string> {
  const file = new File([params.blob], "retake-ref.mp4", {
    type: params.blob.type || "video/mp4",
  });
  const staged = await uploadGenerativeMediaFile({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    file,
    cloudConfigured: params.cloudConfigured,
    mediaKind: "ai-video",
    nodeType: "ai-video",
  });
  const resolved = await resolveMediaReferencesForVideoGenerate({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    cloudConfigured: params.cloudConfigured,
    references: [staged],
  });
  const url = resolved.referenceVideoUrls[0]?.trim();
  if (!url) {
    throw new Error("Unable to resolve retake reference video");
  }
  return url;
}

async function finishLocalResult(
  params: RunVideoRetakePipelineParams,
  blob: Blob
): Promise<void> {
  const file = new File([blob], "retake.mp4", { type: "video/mp4" });

  params.updateNodeData(params.targetNodeId, (current) => ({
    metadata: withGenerativeUploadProgress(current.metadata, true),
  }));

  try {
    const staged = await stageGenerativeCardUpload({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      file,
      cloudConfigured: params.cloudConfigured,
      mediaKind: "ai-video",
      nodeType: "ai-video",
    });

    warmCardUploadPersist({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      staged,
      nodeType: "ai-video",
      cloudConfigured: params.cloudConfigured,
    });

    const uploadError = resolveGenerativeCardUploadError({
      value: staged,
      cloudConfigured: params.cloudConfigured,
      t: params.t,
    });

    params.updateNodeData(params.targetNodeId, (current) => {
      const withResult = isAiVideoRetakePanel(current.metadata)
        ? appendAiVideoGeneratedHistoryItems(
            current,
            [staged as unknown as WorkflowMediaValue],
            { prompt: params.prompt }
          )
        : withAiVideoManualUpload(current, [staged]);
      const merged = { ...current, ...withResult };
      const finalized = finalizeRetakeNode(merged, withResult);
      return {
        ...finalized,
        metadata: withGenerativeUploadProgress(
          withAiVideoGenerateError(finalized.metadata, uploadError),
          false
        ),
      };
    });

    if (uploadError) {
      params.toast.errorRaw(uploadError.summary);
      return;
    }
    params.toast.success("workflow.aiVideoPanel.generated");
  } catch (error) {
    const formatted = prepareGenerativeCardError(
      error instanceof Error ? error.message : String(error),
      params.t,
      "video"
    );
    params.updateNodeData(params.targetNodeId, (current) => ({
      metadata: withGenerativeUploadProgress(
        withAiVideoGenerateError(current.metadata, formatted),
        false
      ),
    }));
    params.toast.errorRaw(formatted.summary);
  }
}

async function runLocalRetake(
  params: RunVideoRetakePipelineParams,
  segments: readonly VideoRetakeSegment[]
): Promise<void> {
  if (params.skipStitch) {
    const retakeSegment = segments.find((segment) => segment.role === "retake");
    if (!retakeSegment) {
      throw new Error("Retake segment is missing");
    }
    const { blob } = await trimVideoLocally({
      sourceUrl: params.trimSourceVideoUrl,
      startSec: retakeSegment.range.startSec,
      endSec: retakeSegment.range.endSec,
    });
    const referenceVideoUrl = await resolveLocalRetakeReferenceUrl({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      cloudConfigured: params.cloudConfigured,
      blob,
    });
    const generated = await generateRetakeClip({
      pipeline: params,
      referenceVideoUrl,
    });
    if (!generated.video) {
      throw new Error("Video generation succeeded without a playable reference");
    }
    writeGeneratedVideoToNode({ pipeline: params, generated });
    return;
  }

  const blobs: Blob[] = [];
  for (const segment of segments) {
    const { blob } = await trimVideoLocally({
      sourceUrl: params.trimSourceVideoUrl,
      startSec: segment.range.startSec,
      endSec: segment.range.endSec,
    });
    blobs.push(blob);
  }

  const retakeIndex = findRetakeSegmentIndex(segments);
  const referenceVideoUrl = await resolveLocalRetakeReferenceUrl({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    cloudConfigured: params.cloudConfigured,
    blob: blobs[retakeIndex]!,
  });
  const generated = await generateRetakeClip({
    pipeline: params,
    referenceVideoUrl,
  });
  if (!generated.video) {
    throw new Error("Video generation succeeded without a playable reference");
  }
  if (segments.length === 1) {
    writeGeneratedVideoToNode({ pipeline: params, generated });
    return;
  }

  const generatedUrl = await resolveGeneratedMediaUrl({
    pipeline: params,
    video: generated.video,
  });
  blobs[retakeIndex] = await fetchVideoBlob({
    organizationId: params.organizationId,
    url: generatedUrl,
  });

  const { blob } = await concatVideoLocally({ blobs });
  await finishLocalResult(params, blob);
}

async function trimCloudSegment(params: {
  readonly pipeline: RunVideoRetakePipelineParams;
  readonly sourceResourceId: string;
  readonly segment: VideoRetakeSegment;
}): Promise<string> {
  const response = await submitVideoTrim(params.pipeline.organizationId, {
    aiInterfaceId: params.pipeline.mediaKitInterfaceId!,
    sourceVideoResourceId: params.sourceResourceId,
    startSec: params.segment.range.startSec,
    endSec: params.segment.range.endSec,
    workflowId: params.pipeline.workflowId,
    clientRequestId: crypto.randomUUID(),
  });
  if (!response.jobId) {
    throw new Error(params.pipeline.t("workflow.videoTrim.submitFailed"));
  }
  return waitForJobSourceUrl(params.pipeline.organizationId, response.jobId);
}

async function concatCloudClips(
  params: RunVideoRetakePipelineParams,
  videoUrls: readonly string[]
): Promise<void> {
  const concatResponse = await submitVideoConcat(params.organizationId, {
    aiInterfaceId: params.mediaKitInterfaceId!,
    videoUrls,
    workflowId: params.workflowId,
    nodeId: params.targetNodeId,
    clientRequestId: crypto.randomUUID(),
  });
  if (concatResponse.workflowNodeContent) {
    params.updateNodeData(params.targetNodeId, (current) => ({
      ...applyWorkflowNodeContentPatch(
        current,
        concatResponse.workflowNodeContent!
      ),
      metadata: withGenerativeProgress(
        withAiVideoGeneratingFlag(current.metadata, true),
        { jobId: concatResponse.jobId, phase: "generating" }
      ),
    }));
  }
  if (!concatResponse.jobId) {
    throw new Error(params.t("workflow.videoTrim.submitFailed"));
  }
  await writeCloudResultToNode({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    targetNodeId: params.targetNodeId,
    jobId: concatResponse.jobId,
    cloudConfigured: params.cloudConfigured,
    updateNodeData: params.updateNodeData,
    toast: params.toast,
  });
}

async function runCloudRetake(
  params: RunVideoRetakePipelineParams,
  segments: readonly VideoRetakeSegment[]
): Promise<void> {
  if (!params.mediaKitInterfaceId) {
    throw new Error(params.t("workflow.videoTrim.notConfiguredHint"));
  }
  const sourceResourceId = getResourceIdFromValue(params.sourceMedia);
  if (!sourceResourceId || !isCloudSourceMedia(params.sourceMedia)) {
    throw new Error(params.t("workflow.videoTrim.sourceNotCloud"));
  }

  if (params.skipStitch) {
    const retakeSegment = segments.find((segment) => segment.role === "retake");
    if (!retakeSegment) {
      throw new Error("Retake segment is missing");
    }
    const referenceVideoUrl = await trimCloudSegment({
      pipeline: params,
      sourceResourceId,
      segment: retakeSegment,
    });
    const generated = await generateRetakeClip({
      pipeline: params,
      referenceVideoUrl,
    });
    if (!generated.video) {
      throw new Error("Video generation succeeded without a playable reference");
    }
    writeGeneratedVideoToNode({ pipeline: params, generated });
    return;
  }

  const clipUrls: string[] = [];
  for (const segment of segments) {
    clipUrls.push(
      await trimCloudSegment({
        pipeline: params,
        sourceResourceId,
        segment,
      })
    );
  }

  const retakeIndex = findRetakeSegmentIndex(segments);
  const generated = await generateRetakeClip({
    pipeline: params,
    referenceVideoUrl: clipUrls[retakeIndex]!,
  });
  if (!generated.video) {
    throw new Error("Video generation succeeded without a playable reference");
  }
  if (segments.length === 1) {
    writeGeneratedVideoToNode({ pipeline: params, generated });
    return;
  }

  clipUrls[retakeIndex] = await resolveGeneratedMediaUrl({
    pipeline: params,
    video: generated.video,
  });
  await concatCloudClips(params, clipUrls);
}

export function runVideoRetakePipeline(
  params: RunVideoRetakePipelineParams
): void {
  resetNodeGenerationCancelled(params.targetNodeId);
  markTargetBusy({
    updateNodeData: params.updateNodeData,
    targetNodeId: params.targetNodeId,
    supportsTaskCancel: params.supportsTaskCancel,
  });

  void (async () => {
    try {
      const segments = splitVideoRetakeSegments(
        params.committedRange,
        params.videoDurationSec
      );
      if (params.highQuality) {
        await runCloudRetake(params, segments);
        return;
      }
      await runLocalRetake(params, segments);
    } catch (error) {
      if (
        isGenerativeGenerationCancelled(error) ||
        isNodeGenerationCancelled(params.targetNodeId)
      ) {
        markTargetCancelled({
          updateNodeData: params.updateNodeData,
          targetNodeId: params.targetNodeId,
        });
        return;
      }
      markTargetFailed({
        updateNodeData: params.updateNodeData,
        targetNodeId: params.targetNodeId,
        t: params.t,
        toast: params.toast,
        error,
      });
    }
  })();
}
