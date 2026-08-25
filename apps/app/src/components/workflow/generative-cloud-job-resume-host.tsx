import type { MediaReference, ResourceIdReference } from "@dafthunk/types";
import { hasCloudAcceleratingResource } from "@dafthunk/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { readAiAudioGenerationParams } from "@/components/workflow/ai-audio-params-popover";
import {
  appendAiAudioGeneratedHistoryItems,
  readAiAudioGeneratingJobId,
  readAiAudioResult,
  readAiAudioResultHistory,
  withAiAudioGeneratingHistoryFailed,
  withAiAudioGenerateError,
  withAiAudioGeneratingFlag,
  withAiAudioStagingPreview,
} from "@/components/workflow/ai-audio-node-utils";
import { readAiImageGenerationParams } from "@/components/workflow/ai-image-params-popover";
import {
  readAiImageGeneratingJobId,
  readAiImageResult,
  readAiImageResultHistory,
  withAiImageGenerateError,
  withAiImageGeneratedResult,
  withAiImageGeneratingFlag,
  withAiImageGeneratingHistoryFailed,
  withAiImageStagingPreview,
} from "@/components/workflow/ai-image-node-utils";
import { readAiVideoGenerationParams } from "@/components/workflow/ai-video-params-popover";
import {
  appendAiVideoGeneratedHistoryItems,
  readAiVideoGeneratingJobId,
  readAiVideoResult,
  readAiVideoResultHistory,
  withAiVideoGeneratingHistoryFailed,
  withAiVideoGenerateError,
  withAiVideoGeneratingFlag,
  withAiVideoStagingPreview,
} from "@/components/workflow/ai-video-node-utils";
import { getCanvasMaintenanceFrozen } from "@/lib/canvas-maintenance-freeze";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { prepareGenerativeCardError } from "@/components/workflow/prepare-generative-card-error";
import { readGenerativePrompt } from "@/components/workflow/generative-card-upload-utils";
import {
  clearGenerativeProgress,
  isGenerativePersistPhase,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
  withGenerativeProgress,
} from "@/components/workflow/generative-progress-utils";
import {
  isGenerativeGenerationCancelled,
  isNodeGenerationCancelled,
} from "@/components/workflow/generative-generation-cancel";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { useWorkflow } from "@/components/workflow/workflow-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeCloudJobProgress, type ResolveGenerativeJobMediaResult } from "@/hooks/use-generative-cloud-job";
import { useSyncGeneratingResourceRefs } from "@/hooks/use-sync-generating-resource-refs";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import { readGenerativeNodeInterfaceId } from "@/components/workflow/generative-model-binding";

export type GenerativeCloudJobResumeModality = "image" | "video" | "audio";

export interface GenerativeCloudJobResumeHostProps {
  readonly nodeId: string;
  readonly modality: GenerativeCloudJobResumeModality;
  readonly data: WorkflowNodeType;
}

function readResumeJobId(
  modality: GenerativeCloudJobResumeModality,
  metadata: Record<string, string> | undefined,
  inputs: WorkflowNodeType["inputs"]
): string | undefined {
  return (
    readGenerativeProgressJobId(metadata) ??
    (modality === "image"
      ? readAiImageGeneratingJobId(inputs)
      : modality === "video"
        ? readAiVideoGeneratingJobId(inputs)
        : readAiAudioGeneratingJobId(inputs))
  );
}

export function GenerativeCloudJobResumeHost({
  nodeId,
  modality,
  data,
}: GenerativeCloudJobResumeHostProps): null {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();
  const { updateNodeData, disabled = false } = useWorkflow();
  const { t } = useTranslation();
  const toast = useAppToast();
  const orgId = organization?.id;
  const [persistPhase, setPersistPhase] = useState<
    "downloading" | "uploading" | null
  >(null);
  const [isResuming, setIsResuming] = useState(false);
  const staleCancelledPhaseRef = useRef(
    modality === "video" &&
      readGenerativeProgressPhase(data.metadata) === "cancelled"
  );

  useEffect(() => {
    if (!staleCancelledPhaseRef.current || !updateNodeData) {
      return;
    }
    staleCancelledPhaseRef.current = false;
    updateNodeData(nodeId, (current) => ({
      metadata: clearGenerativeProgress(current.metadata),
    }));
  }, [nodeId, updateNodeData]);

  const shouldAbortJobPoll = useCallback(
    () => isNodeGenerationCancelled(nodeId) || getCanvasMaintenanceFrozen(),
    [nodeId]
  );

  const applyBusyMetadata = useCallback(
    (metadata: Record<string, string> | undefined, busy: boolean) => {
      if (modality === "image") {
        return withAiImageGeneratingFlag(metadata, busy);
      }
      if (modality === "video") {
        return withAiVideoGeneratingFlag(metadata, busy);
      }
      return withAiAudioGeneratingFlag(metadata, busy);
    },
    [modality]
  );

  const handleStaged = useCallback(
    (stagedMedia: readonly ResourceIdReference[]) => {
      if (!updateNodeData || stagedMedia.length === 0) {
        return;
      }
      updateNodeData(nodeId, (current) => {
        const withPreview =
          modality === "image"
            ? withAiImageStagingPreview(current, stagedMedia)
            : modality === "video"
              ? withAiVideoStagingPreview(current, stagedMedia)
              : withAiAudioStagingPreview(current, stagedMedia);
        const withBusy = applyBusyMetadata(current.metadata, true);
        const withGenerateError =
          modality === "image"
            ? withAiImageGenerateError(withBusy, null)
            : modality === "video"
              ? withAiVideoGenerateError(withBusy, null)
              : withAiAudioGenerateError(withBusy, null);
        return {
          ...withPreview,
          metadata: withGenerativeProgress(withGenerateError, {
            phase: "uploading",
            stagingMediaIds: stagedMedia.map((entry) => entry.resourceId),
          }),
        };
      });
    },
    [applyBusyMetadata, modality, nodeId, updateNodeData]
  );

  const handleResumeSuccess = useCallback(
    async (result: ResolveGenerativeJobMediaResult) => {
      if (!updateNodeData || result.media.length === 0 || !orgId || !workflowId) {
        return;
      }

        const jobId = readResumeJobId(modality, data.metadata, data.inputs);
        const canWriteHistory = !jobId || tryClaimGenerativeJobFinalize(jobId);

        if (!canWriteHistory) {
          updateNodeData(nodeId, (current) => {
            const cleared = clearGenerativeProgress(current.metadata);
            const withBusy = applyBusyMetadata(cleared, false);
            const withError =
              modality === "image"
                ? withAiImageGenerateError(withBusy, null)
                : modality === "video"
                  ? withAiVideoGenerateError(withBusy, null)
                  : withAiAudioGenerateError(withBusy, null);
            return { metadata: withError };
          });
          return;
        }

        const nodeType =
          modality === "image"
            ? "ai-image"
            : modality === "video"
              ? "ai-video"
              : "ai-audio";

        persistMediaForNodeInBackground({
          organizationId: orgId,
          workflowId,
          media: result.media,
          nodeType,
          cloudConfigured,
        });

        updateNodeData(nodeId, (current) => {
          const prompt = readGenerativePrompt(current.inputs).trim();
          const params =
            modality === "image"
              ? readAiImageGenerationParams(current.inputs)
              : modality === "video"
                ? readAiVideoGenerationParams(current.inputs)
                : readAiAudioGenerationParams(current.inputs);

          const withResult =
            modality === "image"
              ? withAiImageGeneratedResult(current, result.media, {
                  prompt,
                  params,
                  platformModelId: result.modelCanonicalId,
                  requestSnapshot: result.requestSnapshot,
                  jobId: readResumeJobId(
                    modality,
                    current.metadata,
                    current.inputs
                  ),
                })
              : modality === "video"
                ? appendAiVideoGeneratedHistoryItems(
                    current,
                    [result.media[0]!],
                    {
                      prompt,
                      params,
                      jobId: readResumeJobId(
                        modality,
                        current.metadata,
                        current.inputs
                      ),
                    }
                  )
                : appendAiAudioGeneratedHistoryItems(
                    current,
                    [result.media[0]!],
                    {
                      prompt,
                      params,
                      jobId: readResumeJobId(
                        modality,
                        current.metadata,
                        current.inputs
                      ),
                    }
                  );

          const cleared = clearGenerativeProgress(withResult.metadata);
          const withBusy = applyBusyMetadata(cleared, false);
          const withError =
            modality === "image"
              ? withAiImageGenerateError(withBusy, null)
              : modality === "video"
                ? withAiVideoGenerateError(withBusy, null)
                : withAiAudioGenerateError(withBusy, null);

          return { ...withResult, metadata: withError };
        });

        if (modality === "image") {
          if (result.media.length > 1) {
            toast.success("workflow.aiImagePanel.generatedBatch", {
              count: result.media.length,
            });
          } else {
            toast.success("workflow.aiImagePanel.generated");
          }
        } else if (modality === "video") {
          toast.success("workflow.aiVideoPanel.generated");
        } else {
          toast.success("workflow.aiAudioPanel.generated");
        }
    },
    [
      applyBusyMetadata,
      cloudConfigured,
      data.inputs,
      data.metadata,
      modality,
      nodeId,
      orgId,
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  const handleResumeError = useCallback(
    (error: unknown) => {
      if (getCanvasMaintenanceFrozen()) {
        return;
      }
      if (
        isGenerativeGenerationCancelled(error) ||
        isNodeGenerationCancelled(nodeId)
      ) {
        return;
      }
      const raw = error instanceof Error ? error.message : String(error);
      const cardError = prepareGenerativeCardError(raw, t, modality);
      updateNodeData?.(nodeId, (current) => {
        const cleared = clearGenerativeProgress(current.metadata);
        const withBusy = applyBusyMetadata(cleared, false);
        const withError =
          modality === "image"
            ? withAiImageGenerateError(withBusy, cardError)
            : modality === "video"
              ? withAiVideoGenerateError(withBusy, cardError)
              : withAiAudioGenerateError(withBusy, cardError);
        const failedJobId = readResumeJobId(
          modality,
          current.metadata,
          current.inputs
        );
        if (modality === "image") {
          return {
            ...withAiImageGeneratingHistoryFailed(
              current,
              failedJobId ?? readAiImageGeneratingJobId(current.inputs)
            ),
            metadata: withError,
          };
        }
        if (modality === "video") {
          return {
            ...withAiVideoGeneratingHistoryFailed(current, failedJobId),
            metadata: withError,
          };
        }
        return {
          ...withAiAudioGeneratingHistoryFailed(current, failedJobId),
          metadata: withError,
        };
      });
      toast.errorRaw(cardError.summary);
    },
    [applyBusyMetadata, modality, nodeId, t, toast, updateNodeData]
  );

  const syncMedia = useMemo(
    () =>
      modality === "image"
        ? [
            ...readAiImageResult(data.inputs, data.outputs),
            ...readAiImageResultHistory(data.inputs).items.flatMap(
              (item) => item.images
            ),
          ]
        : modality === "video"
          ? [
              ...readAiVideoResult(data.inputs, data.outputs),
              ...readAiVideoResultHistory(data.inputs).items.flatMap(
                (item) => item.videos
              ),
            ]
          : [
              ...readAiAudioResult(data.inputs, data.outputs),
              ...readAiAudioResultHistory(data.inputs).items.flatMap(
                (item) => item.audios
              ),
            ],
    [data.inputs, data.outputs, modality]
  );

  useSyncGeneratingResourceRefs({
    orgId,
    nodeId,
    modality,
    media: syncMedia,
    enabled: !disabled && !getCanvasMaintenanceFrozen(),
    holdClear:
      isGenerativePersistPhase(readGenerativeProgressPhase(data.metadata)) &&
      !hasCloudAcceleratingResource(syncMedia),
    updateNodeData,
  });

  useGenerativeCloudJobProgress({
    nodeId,
    orgId,
    workflowId,
    cloudConfigured,
    metadata: data.metadata,
    isGenerating: isResuming,
    persistPhase,
    autoResume: !disabled && !getCanvasMaintenanceFrozen(),
    resumeJobId: readResumeJobId(modality, data.metadata, data.inputs),
    updateNodeData,
    setPersistPhase,
    setIsGenerating: setIsResuming,
    applyBusyMetadata,
    onStaged: handleStaged,
    onResumeSuccess: handleResumeSuccess,
    onResumeError: handleResumeError,
    shouldAbortJobPoll,
    cloudAccelerationEnabled: modality === "image" || modality === "video",
    aiInterfaceId: readGenerativeNodeInterfaceId(data),
  });

  return null;
}
