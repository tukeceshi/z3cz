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
import { GenerativeGenerationCancelledError } from "@/components/workflow/generative-generation-cancel";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import {
  releaseGenerativeJobResume,
  tryClaimGenerativeJobResume,
} from "@/services/generative-cloud-job-resume-registry";
import { getGenerationJob } from "@/services/platform-ai-model-service";
import {
  resolveCloudGenerationJobMedia,
  type PersistGenerativeMediaPhase,
} from "@/services/persist-generative-media-from-url";
import type { ImageGenerationRequestSnapshot, LocalMediaReference, WorkflowMediaValue } from "@dafthunk/types";
import { VIDEO_JOB_CLIENT_POLL_INTERVAL_MS } from "@dafthunk/types";

const JOB_POLL_INTERVAL_MS = VIDEO_JOB_CLIENT_POLL_INTERVAL_MS;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForJobFinalMedia(
  organizationId: string,
  jobId: string,
  shouldAbort?: () => boolean
): Promise<ResolveGenerativeJobMediaResult> {
  while (true) {
    const response = await getGenerationJob(organizationId, jobId);
    if (response.job.status === "succeeded") {
      return {
        media: response.finalMedia ?? [],
        owned: false,
        requestSnapshot: response.job.resultJson?.requestSnapshot,
        modelCanonicalId: response.job.modelCanonicalId,
      };
    }
    if (
      response.job.status === "failed"
    ) {
      throw new Error(
        response.job.failureReason ?? "Generation failed"
      );
    }
    if (response.job.status === "cancelled") {
      throw new GenerativeGenerationCancelledError();
    }
    if (shouldAbort?.()) {
      throw new GenerativeGenerationCancelledError();
    }
    await sleep(JOB_POLL_INTERVAL_MS);
  }
}

async function readJobPersistMeta(
  organizationId: string,
  jobId: string
): Promise<{
  readonly requestSnapshot?: ImageGenerationRequestSnapshot;
  readonly modelCanonicalId?: string;
}> {
  const response = await getGenerationJob(organizationId, jobId);
  return {
    requestSnapshot: response.job.resultJson?.requestSnapshot,
    modelCanonicalId: response.job.modelCanonicalId,
  };
}

export interface ResolveGenerativeJobMediaResult {
  readonly media: readonly WorkflowMediaValue[];
  /** True only for the caller that claimed resume and ran local persist. */
  readonly owned: boolean;
  readonly requestSnapshot?: ImageGenerationRequestSnapshot;
  readonly modelCanonicalId?: string;
}

interface UseGenerativeCloudJobOptions {
  readonly nodeId: string;
  readonly orgId: string | undefined;
  readonly workflowId: string | undefined;
  readonly cloudConfigured: boolean;
  readonly metadata: Record<string, string> | undefined;
  readonly isGenerating: boolean;
  readonly persistPhase: PersistGenerativeMediaPhase | null;
  readonly autoResume?: boolean;
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: {
      readonly metadata?: Record<string, string>;
    }) => { readonly metadata?: Record<string, string> }
  ) => void;
  readonly setPersistPhase: (phase: PersistGenerativeMediaPhase | null) => void;
  readonly setIsGenerating: (generating: boolean) => void;
  readonly applyBusyMetadata?: (
    metadata: Record<string, string> | undefined,
    busy: boolean
  ) => Record<string, string> | undefined;
  readonly onStaged?: (localMedia: readonly LocalMediaReference[]) => void;
  readonly onResumeSuccess?: (result: ResolveGenerativeJobMediaResult) => void;
  readonly onResumeError?: (error: unknown) => void;
  readonly shouldAbortJobPoll?: () => boolean;
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
  ) => Promise<ResolveGenerativeJobMediaResult>;
  readonly activeProgressPhase: GenerativeProgressPhase | null;
} {
  const resumeAttemptedRef = useRef(false);
  const initialResumeJobIdRef = useRef(
    readGenerativeProgressJobId(options.metadata)
  );

  const syncProgress = useCallback(
    (params: {
      readonly jobId?: string | null;
      readonly phase?: GenerativeProgressPhase | null;
      readonly stagingMediaIds?: readonly string[] | null;
    }) => {
      options.updateNodeData?.(options.nodeId, (current) => {
        let metadata = withGenerativeProgress(current.metadata, params);
        if (options.applyBusyMetadata) {
          if (params.phase === null) {
            metadata = options.applyBusyMetadata(metadata, false);
          } else if (params.phase) {
            metadata = options.applyBusyMetadata(metadata, true);
          }
        }
        return { metadata };
      });
    },
    [options.applyBusyMetadata, options.nodeId, options.updateNodeData]
  );

  const clearProgress = useCallback(() => {
    options.updateNodeData?.(options.nodeId, (current) => {
      let metadata = clearGenerativeProgress(current.metadata);
      if (options.applyBusyMetadata) {
        metadata = options.applyBusyMetadata(metadata, false);
      }
      return { metadata };
    });
  }, [options.applyBusyMetadata, options.nodeId, options.updateNodeData]);

  const resolveJobMedia = useCallback(
    async (jobId: string): Promise<ResolveGenerativeJobMediaResult> => {
      const claimed = tryClaimGenerativeJobResume(jobId);
      if (!claimed) {
        try {
          return await waitForJobFinalMedia(
            options.orgId!,
            jobId,
            options.shouldAbortJobPoll
          );
        } catch (error) {
          if (error instanceof GenerativeGenerationCancelledError) {
            throw error;
          }
          // Owner (or another waiter) surfaces job failure; do not fight over UI.
          return { media: [], owned: false };
        }
      }

      try {
        const resumedPhase = readGenerativeProgressPhase(options.metadata);
        syncProgress({
          jobId,
          phase: resumedPhase ?? "generating",
        });

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
          shouldAbortJobPoll: options.shouldAbortJobPoll,
        });
        const meta = await readJobPersistMeta(options.orgId!, jobId);
        return {
          media,
          owned: true,
          requestSnapshot: meta.requestSnapshot,
          modelCanonicalId: meta.modelCanonicalId,
        };
      } finally {
        releaseGenerativeJobResume(jobId);
      }
    },
    [
      options.metadata,
      options.onStaged,
      options.orgId,
      options.setPersistPhase,
      options.shouldAbortJobPoll,
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
    if (!options.autoResume) {
      return;
    }

    const jobId = initialResumeJobIdRef.current;
    if (
      !jobId ||
      !options.orgId ||
      !options.cloudConfigured ||
      options.isGenerating ||
      resumeAttemptedRef.current ||
      !options.onResumeSuccess ||
      !options.onResumeError
    ) {
      return;
    }

    resumeAttemptedRef.current = true;
    options.setIsGenerating(true);

    void resolveJobMedia(jobId)
      .then((result) => {
        if (!result.owned) {
          return;
        }
        options.onResumeSuccess?.(result);
        clearProgress();
      })
      .catch((error) => {
        options.onResumeError?.(error);
        clearProgress();
      })
      .finally(() => {
        options.setPersistPhase(null);
        options.setIsGenerating(false);
      });
  }, [
    clearProgress,
    options.autoResume,
    options.cloudConfigured,
    options.isGenerating,
    options.onResumeError,
    options.onResumeSuccess,
    options.orgId,
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
    case "cancelling":
      return "workflow.generativeCancel.inProgress";
    case "cancelled":
      return "workflow.generativeCancel.success";
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
    case "cancelling":
      return `${prefix}.cardCancelling`;
    case "cancelled":
      return `${prefix}.cardCancelled`;
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
