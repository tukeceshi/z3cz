import type { LocalMediaReference, MediaReference } from "@dafthunk/types";
import { useCallback, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { readAiAudioGenerationParams } from "@/components/workflow/ai-audio-params-popover";
import {
  appendAiAudioGeneratedHistoryItems,
  withAiAudioGenerateError,
  withAiAudioGeneratingFlag,
  withAiAudioStagingPreview,
} from "@/components/workflow/ai-audio-node-utils";
import { readAiImageGenerationParams } from "@/components/workflow/ai-image-params-popover";
import {
  withAiImageGenerateError,
  withAiImageGeneratedResult,
  withAiImageGeneratingFlag,
  withAiImageStagingPreview,
} from "@/components/workflow/ai-image-node-utils";
import { readAiVideoGenerationParams } from "@/components/workflow/ai-video-params-popover";
import {
  appendAiVideoGeneratedHistoryItems,
  withAiVideoGenerateError,
  withAiVideoGeneratingFlag,
  withAiVideoStagingPreview,
} from "@/components/workflow/ai-video-node-utils";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import {
  formatGenerativeApiError,
} from "@/components/workflow/format-generative-api-error";
import { prepareGenerativeCardError } from "@/components/workflow/prepare-generative-card-error";
import { readGenerativePrompt } from "@/components/workflow/generative-card-upload-utils";
import {
  clearGenerativeProgress,
  withGenerativeProgress,
} from "@/components/workflow/generative-progress-utils";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { useWorkflow } from "@/components/workflow/workflow-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeCloudJobProgress } from "@/hooks/use-generative-cloud-job";

export type GenerativeCloudJobResumeModality = "image" | "video" | "audio";

export interface GenerativeCloudJobResumeHostProps {
  readonly nodeId: string;
  readonly modality: GenerativeCloudJobResumeModality;
  readonly data: WorkflowNodeType;
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
    (localMedia: readonly LocalMediaReference[]) => {
      if (!updateNodeData || localMedia.length === 0) {
        return;
      }
      updateNodeData(nodeId, (current) => {
        const withPreview =
          modality === "image"
            ? withAiImageStagingPreview(current, localMedia)
            : modality === "video"
              ? withAiVideoStagingPreview(current, localMedia)
              : withAiAudioStagingPreview(current, localMedia);
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
            stagingMediaIds: localMedia.map((entry) => entry.mediaId),
          }),
        };
      });
    },
    [applyBusyMetadata, modality, nodeId, updateNodeData]
  );

  const handleResumeSuccess = useCallback(
    (media: readonly MediaReference[]) => {
      if (!updateNodeData || media.length === 0) {
        return;
      }
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
            ? withAiImageGeneratedResult(current, media, { prompt, params })
            : modality === "video"
              ? appendAiVideoGeneratedHistoryItems(current, [media[0]!], {
                  prompt,
                  params,
                })
              : appendAiAudioGeneratedHistoryItems(current, [media[0]!], {
                  prompt,
                  params,
                });

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
        toast.success("workflow.aiImagePanel.generated");
      } else if (modality === "video") {
        toast.success("workflow.aiVideoPanel.generated");
      } else {
        toast.success("workflow.aiAudioPanel.generated");
      }
    },
    [applyBusyMetadata, modality, nodeId, toast, updateNodeData]
  );

  const handleResumeError = useCallback(
    (error: unknown) => {
      const formatted = formatGenerativeApiError(
        error instanceof Error ? error.message : String(error),
        t
      );
      updateNodeData?.(nodeId, (current) => {
        const cleared = clearGenerativeProgress(current.metadata);
        const withBusy = applyBusyMetadata(cleared, false);
        const withError =
          modality === "image"
            ? withAiImageGenerateError(
                withBusy,
                prepareGenerativeCardError(formatted, t)
              )
            : modality === "video"
              ? withAiVideoGenerateError(
                  withBusy,
                  prepareGenerativeCardError(formatted, t)
                )
              : withAiAudioGenerateError(
                  withBusy,
                  prepareGenerativeCardError(formatted, t)
                );
        return { metadata: withError };
      });
      toast.errorRaw(formatted);
    },
    [applyBusyMetadata, modality, nodeId, t, toast, updateNodeData]
  );

  useGenerativeCloudJobProgress({
    nodeId,
    orgId,
    workflowId,
    cloudConfigured,
    metadata: data.metadata,
    isGenerating: isResuming,
    persistPhase,
    autoResume: !disabled,
    updateNodeData,
    setPersistPhase,
    setIsGenerating: setIsResuming,
    applyBusyMetadata,
    onStaged: handleStaged,
    onResumeSuccess: handleResumeSuccess,
    onResumeError: handleResumeError,
  });

  return null;
}
