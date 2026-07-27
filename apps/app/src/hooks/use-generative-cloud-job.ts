import { useCallback, useEffect, useRef } from "react";

import {
  clearGenerativeProgress,
  isGenerativeProgressActive,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
  readGenerativeStagingMediaIds,
  withGenerativeProgress,
  type GenerativeProgressPhase,
} from "@/components/workflow/generative-progress-utils";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import {
  resolveCloudGenerationJobMedia,
  type PersistGenerativeMediaPhase,
} from "@/services/persist-generative-media-from-url";
import type { LocalMediaReference, MediaReference } from "@dafthunk/types";

interface UseGenerativeCloudJobOptions {
  readonly nodeId: string;
  readonly orgId: string | undefined;
  readonly workflowId: string | undefined;
  readonly cloudConfigured: boolean;
  readonly metadata: Record<string, string> | undefined;
  readonly isGenerating: boolean;
  readonly persistPhase: PersistGenerativeMediaPhase | null;
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: {
      readonly metadata?: Record<string, string>;
    }) => { readonly metadata?: Record<string, string> }
  ) => void;
  readonly setPersistPhase: (phase: PersistGenerativeMediaPhase | null) => void;
  readonly setIsGenerating: (generating: boolean) => void;
  readonly onStaged?: (localMedia: readonly LocalMediaReference[]) => void;
  readonly onResumeSuccess: (media: readonly MediaReference[]) => void;
  readonly onResumeError: (error: unknown) => void;
}

export function useGenerativeCloudJobProgress(
  options: UseGenerativeCloudJobOptions
): {
  readonly syncProgress: (params: {
    readonly jobId?: string | null;
    readonly phase?: GenerativeProgressPhase | null;
    readonly stagingMediaIds?: readonly string[] | null;
  }) => void;
  readonly clearProgress: () => void;
  readonly resolveJobMedia: (
    jobId: string
  ) => Promise<readonly MediaReference[]>;
  readonly activeProgressPhase: GenerativeProgressPhase | null;
} {
  const resumeAttemptedRef = useRef(false);
  const resolvedJobIdsRef = useRef(new Set<string>());

  const syncProgress = useCallback(
    (params: {
      readonly jobId?: string | null;
      readonly phase?: GenerativeProgressPhase | null;
      readonly stagingMediaIds?: readonly string[] | null;
    }) => {
      options.updateNodeData?.(options.nodeId, (current) => ({
        metadata: withGenerativeProgress(current.metadata, params),
      }));
    },
    [options.nodeId, options.updateNodeData]
  );

  const clearProgress = useCallback(() => {
    options.updateNodeData?.(options.nodeId, (current) => ({
      metadata: clearGenerativeProgress(current.metadata),
    }));
  }, [options.nodeId, options.updateNodeData]);

  const resolveJobMedia = useCallback(
    async (jobId: string) => {
      const resumedPhase = readGenerativeProgressPhase(options.metadata);
      syncProgress({
        jobId,
        phase: resumedPhase ?? "generating",
      });
      try {
        const media = await resolveCloudGenerationJobMedia({
          organizationId: options.orgId!,
          jobId,
          workflowId: options.workflowId,
          stagingMediaIds: readGenerativeStagingMediaIds(options.metadata),
          onPhase: options.setPersistPhase,
          onProgressPhase: (phase) => syncProgress({ jobId, phase }),
          onStaged: (localMedia) => {
            syncProgress({
              jobId,
              phase: "uploading",
              stagingMediaIds: localMedia.map((entry) => entry.mediaId),
            });
            options.onStaged?.(localMedia);
          },
        });
        resolvedJobIdsRef.current.add(jobId);
        return media;
      } catch (error) {
        resolvedJobIdsRef.current.add(jobId);
        throw error;
      }
    },
    [
      options.metadata,
      options.onStaged,
      options.orgId,
      options.setPersistPhase,
      options.workflowId,
      syncProgress,
    ]
  );

  const metadataPhase = readGenerativeProgressPhase(options.metadata);
  const activeProgressPhase: GenerativeProgressPhase | null =
    metadataPhase ??
    (options.persistPhase === "downloading"
      ? "downloading"
      : options.persistPhase === "uploading"
        ? "uploading"
        : options.isGenerating
          ? "generating"
          : null);

  useGenerativeMediaWorkSession(
    options.isGenerating ||
      options.persistPhase !== null ||
      isGenerativeProgressActive(options.metadata) ||
      readGenerativeStagingMediaIds(options.metadata).length > 0
  );

  useEffect(() => {
    const jobId = readGenerativeProgressJobId(options.metadata);
    if (
      !jobId ||
      !options.orgId ||
      !options.cloudConfigured ||
      options.isGenerating ||
      resumeAttemptedRef.current ||
      resolvedJobIdsRef.current.has(jobId)
    ) {
      return;
    }

    resumeAttemptedRef.current = true;
    options.setIsGenerating(true);

    void resolveJobMedia(jobId)
      .then((media) => {
        options.onResumeSuccess(media);
      })
      .catch((error) => {
        options.onResumeError(error);
      })
      .finally(() => {
        options.setPersistPhase(null);
        options.setIsGenerating(false);
        clearProgress();
      });
  }, [
    clearProgress,
    options.cloudConfigured,
    options.isGenerating,
    options.metadata,
    options.orgId,
    options.onResumeError,
    options.onResumeSuccess,
    options.setIsGenerating,
    options.setPersistPhase,
    resolveJobMedia,
  ]);

  return {
    syncProgress,
    clearProgress,
    resolveJobMedia,
    activeProgressPhase,
  };
}

export function generativeProgressButtonKey(
  phase: GenerativeProgressPhase | null
): string {
  switch (phase) {
    case "downloading":
      return "workflow.aiImagePanel.persistDownloading";
    case "uploading":
      return "workflow.aiImagePanel.persistUploading";
    case "server_persisting":
      return "workflow.aiImagePanel.serverPersisting";
    case "queued":
      return "workflow.aiImagePanel.queued";
    case "generating":
      return "workflow.aiImagePanel.generating";
    default:
      return "workflow.aiImagePanel.generate";
  }
}

export function generativeVideoProgressButtonKey(
  phase: GenerativeProgressPhase | null
): string {
  switch (phase) {
    case "downloading":
      return "workflow.aiVideoPanel.persistDownloading";
    case "uploading":
      return "workflow.aiVideoPanel.persistUploading";
    case "server_persisting":
      return "workflow.aiVideoPanel.serverPersisting";
    case "queued":
      return "workflow.aiVideoPanel.queued";
    case "generating":
      return "workflow.aiVideoPanel.generating";
    default:
      return "workflow.aiVideoPanel.generate";
  }
}

export function generativeAudioProgressButtonKey(
  phase: GenerativeProgressPhase | null
): string {
  switch (phase) {
    case "downloading":
      return "workflow.aiAudioPanel.persistDownloading";
    case "uploading":
      return "workflow.aiAudioPanel.persistUploading";
    case "server_persisting":
      return "workflow.aiAudioPanel.serverPersisting";
    case "queued":
      return "workflow.aiAudioPanel.queued";
    case "generating":
      return "workflow.aiAudioPanel.generating";
    default:
      return "workflow.aiAudioPanel.generate";
  }
}

export function generativeCardProgressKey(
  phase: GenerativeProgressPhase | null,
  mediaKind: "image" | "video" | "audio"
): string {
  const prefix =
    mediaKind === "image"
      ? "workflow.aiImagePanel"
      : mediaKind === "video"
        ? "workflow.aiVideoPanel"
        : "workflow.aiAudioPanel";

  switch (phase) {
    case "downloading":
      return `${prefix}.cardDownloading`;
    case "uploading":
      return `${prefix}.cardUploading`;
    case "server_persisting":
      return `${prefix}.cardServerPersisting`;
    case "queued":
      return `${prefix}.cardQueued`;
    case "generating":
      return `${prefix}.cardGenerating`;
    default:
      if (mediaKind === "image") {
        return "workflow.aiImagePanel.cardUploadPlaceholder";
      }
      if (mediaKind === "video") {
        return "workflow.aiVideoPanel.cardUploadPlaceholder";
      }
      return "workflow.aiAudioPanel.cardUploadPlaceholder";
  }
}
