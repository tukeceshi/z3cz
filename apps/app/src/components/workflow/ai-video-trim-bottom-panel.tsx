import {
  getResourceIdFromValue,
  isCloudStoredResource,
  isVolcanoMediaKitVideoTrimEnabled,
  shouldWarnVideoTrimShortDuration,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
  videoTrimSelectionDurationSec,
  type VideoTrimRangeSec,
} from "@dafthunk/types";
import { useViewport } from "@xyflow/react";
import LoaderIcon from "lucide-react/icons/loader";
import PauseIcon from "lucide-react/icons/pause";
import PlayIcon from "lucide-react/icons/play";
import XIcon from "lucide-react/icons/x";
import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useAppToast } from "@/hooks/use-app-toast";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import {
  releaseGenerativeJobResume,
  tryClaimGenerativeJobFinalize,
  tryClaimGenerativeJobResume,
} from "@/services/generative-cloud-job-resume-registry";
import {
  getGenerationJob,
  submitVideoTrim,
} from "@/services/platform-ai-model-service";
import { resolveCloudGenerationJobMedia } from "@/services/persist-generative-media-from-url";

import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { withGenerativeBottomPanelHidden } from "./generative-card-mode-utils";
import { useGenerativeVideoFileUpload } from "./use-generative-video-file-upload";
import {
  withAiVideoGenerateError,
  withAiVideoGeneratingFlag,
  withAiVideoManualUpload,
} from "./ai-video-node-utils";
import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import { GenerativeBottomPanelShell } from "./generative-bottom-panel-shell";
import {
  clearGenerativeProgress,
  withGenerativeProgress,
  withGenerativeTrimmingProgress,
} from "./generative-progress-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { trimVideoLocally } from "./video-trim-local";
import { VideoTrimLocalTrimHintIcon } from "./video-trim-local-trim-hint-icon";
import { VideoTrimRuler } from "./video-trim-ruler";
import { VideoTrimTimeFields } from "./video-trim-time-fields";
import {
  VIDEO_TRIM_PANEL_ACTION_BUTTON_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_ACTIONS_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_CENTER_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_CLASS,
  VIDEO_TRIM_PANEL_FOOTER_LEFT_CLASS,
  VIDEO_TRIM_PANEL_PRIMARY_BUTTON_CLASS,
  VIDEO_TRIM_PANEL_RULER_ROW_CLASS,
} from "./video-trim-panel-styles";
import { useVideoTrimSession } from "./video-trim-session-context";
import { isWebCodecsVideoTrimSupported } from "./video-trim-utils";
import { useVideoTrimToSiblingNode } from "./use-video-trim-to-sibling-node";
import { VideoTrimShortDurationConfirmDialog } from "./video-trim-short-duration-confirm-dialog";
import {
  readSkipVideoTrimShortDurationConfirm,
  writeSkipVideoTrimShortDurationConfirm,
} from "./video-trim-short-duration-confirm-preference";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export interface AiVideoTrimBottomPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AiVideoTrimBottomPanel({
  nodeId,
  data: _data,
}: AiVideoTrimBottomPanelProps) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { getOrgUrl } = useOrgUrl();
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();
  const {
    session,
    closeTrimSession,
    patchTrimSession,
    commitDraftRange,
    setDraftRange,
    setPlaybackPaused,
  } = useVideoTrimSession();
  const { createTrimSiblingNodeShell } = useVideoTrimToSiblingNode(nodeId);
  const { updateNodeData } = useWorkflow();
  const { uploadVideoFileToNode, blocksGenerativeMedia } =
    useGenerativeVideoFileUpload();
  const { interfaceId: mediaKitInterfaceId, config: mediaKitConfig } =
    useOrgVolcanoMediaKitConfig(orgId);

  const [isStartingTrim, setIsStartingTrim] = useState(false);
  const trimTaskRef = useRef(0);
  const [highQualityHintOpen, setHighQualityHintOpen] = useState(false);
  const [shortDurationConfirmOpen, setShortDurationConfirmOpen] = useState(false);
  const [shortDurationDontAsk, setShortDurationDontAsk] = useState(false);

  const mediaKitTrimAvailable = Boolean(
    mediaKitConfig &&
      isVolcanoMediaKitVideoTrimEnabled({
        enabled: mediaKitConfig.active,
        videoEnhance: mediaKitConfig.snapshot.videoEnhance,
        videoTrim: mediaKitConfig.snapshot.videoTrim,
        subtitleErase: mediaKitConfig.snapshot.subtitleErase,
      }) &&
      mediaKitConfig.hasApiKey
  );

  const handleDraftRangeChange = useCallback(
    (range: VideoTrimRangeSec) => {
      setDraftRange(range);
    },
    [setDraftRange]
  );

  const handleRangeCommit = useCallback(
    (range: VideoTrimRangeSec) => {
      commitDraftRange(range);
    },
    [commitDraftRange]
  );

  const runLocalTrim = useCallback(
    (params: {
      readonly targetNodeId: string;
      readonly trimSourceVideoUrl: string;
      readonly trimRange: VideoTrimRangeSec;
    }) => {
      const taskId = trimTaskRef.current + 1;
      trimTaskRef.current = taskId;

      void (async () => {
        try {
          const { blob } = await trimVideoLocally({
            sourceUrl: params.trimSourceVideoUrl,
            startSec: params.trimRange.startSec,
            endSec: params.trimRange.endSec,
          });
          const file = new File([blob], "trim.mp4", { type: "video/mp4" });
          await uploadVideoFileToNode({ nodeId: params.targetNodeId, file });
        } catch {
          if (trimTaskRef.current !== taskId) {
            return;
          }
          const formatted = prepareGenerativeCardError(
            t("workflow.videoTrim.generateFailed"),
            t,
            "video"
          );
          updateNodeData?.(params.targetNodeId, (current) => ({
            metadata: withGenerativeTrimmingProgress(
              withGenerativeBottomPanelHidden(
                withAiVideoGenerateError(current.metadata, formatted)
              ),
              false
            ),
          }));
          toast.error("workflow.videoTrim.generateFailed");
        }
      })();
    },
    [t, toast, updateNodeData, uploadVideoFileToNode]
  );

  const runCloudTrim = useCallback(
    async (params: {
      readonly targetNodeId: string;
      readonly trimRange: VideoTrimRangeSec;
      readonly sourceResourceId: string;
    }) => {
      if (!orgId || !workflowId || !mediaKitInterfaceId || !updateNodeData) {
        return;
      }

      const clientRequestId = crypto.randomUUID();

      updateNodeData(params.targetNodeId, (current) => ({
        metadata: withGenerativeProgress(
          withAiVideoGeneratingFlag(
            withGenerativeBottomPanelHidden(current.metadata),
            true
          ),
          { phase: "generating" }
        ),
      }));

      try {
        const response = await submitVideoTrim(orgId, {
          aiInterfaceId: mediaKitInterfaceId,
          sourceVideoResourceId: params.sourceResourceId,
          startSec: params.trimRange.startSec,
          endSec: params.trimRange.endSec,
          workflowId,
          nodeId: params.targetNodeId,
          clientRequestId,
        });

        if (response.workflowNodeContent) {
          updateNodeData(params.targetNodeId, (current) => ({
            ...applyWorkflowNodeContentPatch(
              current,
              response.workflowNodeContent!
            ),
            metadata: withGenerativeProgress(
              withAiVideoGeneratingFlag(
                withGenerativeBottomPanelHidden(current.metadata),
                true
              ),
              { jobId: response.jobId, phase: "generating" }
            ),
          }));
        } else if (response.jobId) {
          updateNodeData(params.targetNodeId, (current) => ({
            metadata: withGenerativeProgress(
              withAiVideoGeneratingFlag(
                withGenerativeBottomPanelHidden(current.metadata),
                true
              ),
              { jobId: response.jobId, phase: "generating" }
            ),
          }));
        }

        if (!response.jobId) {
          throw new Error(t("workflow.videoTrim.submitFailed"));
        }

        const jobId = response.jobId;
        const claimed = tryClaimGenerativeJobResume(jobId);
        let media: Awaited<ReturnType<typeof resolveCloudGenerationJobMedia>>;

        try {
          if (!claimed) {
            while (true) {
              const jobResponse = await getGenerationJob(orgId, jobId);
              if (jobResponse.job.status === "succeeded") {
                media = jobResponse.finalMedia ?? [];
                break;
              }
              if (jobResponse.job.status === "failed") {
                throw new Error(
                  jobResponse.job.failureReason ?? t("workflow.videoTrim.generateFailed")
                );
              }
              if (jobResponse.job.status === "cancelled") {
                throw new Error(t("workflow.videoTrim.generateFailed"));
              }
              await sleep(VIDEO_JOB_CLIENT_POLL_INTERVAL_MS);
            }
            if (media.length === 0) {
              return;
            }
          } else {
            media = await resolveCloudGenerationJobMedia({
              organizationId: orgId,
              jobId,
              workflowId,
              cloudConfigured,
              onProgressPhase: (phase) => {
                updateNodeData(params.targetNodeId, (current) => ({
                  metadata: withGenerativeProgress(
                    withAiVideoGeneratingFlag(
                      withGenerativeBottomPanelHidden(current.metadata),
                      true
                    ),
                    { jobId, phase }
                  ),
                }));
              },
            });
          }
        } finally {
          releaseGenerativeJobResume(jobId);
        }

        if (media.length === 0) {
          throw new Error(t("workflow.videoTrim.generateFailed"));
        }

        const canWriteHistory = tryClaimGenerativeJobFinalize(jobId);
        if (canWriteHistory) {
          persistMediaForNodeInBackground({
            organizationId: orgId,
            workflowId,
            media,
            nodeType: "ai-video",
            cloudConfigured,
          });
        }

        updateNodeData(params.targetNodeId, (current) => {
          if (!canWriteHistory) {
            return {
              metadata: withAiVideoGenerateError(
                withAiVideoGeneratingFlag(
                  withGenerativeBottomPanelHidden(
                    clearGenerativeProgress(current.metadata)
                  ),
                  false
                ),
                null
              ),
            };
          }

          const withMedia = withAiVideoManualUpload(current, media);
          return {
            ...withMedia,
            metadata: withAiVideoGenerateError(
              withAiVideoGeneratingFlag(
                withGenerativeBottomPanelHidden(
                  clearGenerativeProgress(withMedia.metadata)
                ),
                false
              ),
              null
            ),
          };
        });

        if (canWriteHistory) {
          toast.success("workflow.aiVideoPanel.generated");
        }
      } catch (error) {
        const formatted = prepareGenerativeCardError(
          error instanceof Error
            ? error.message
            : t("workflow.videoTrim.submitFailed"),
          t,
          "video"
        );
        updateNodeData(params.targetNodeId, (current) => ({
          metadata: withAiVideoGenerateError(
            clearGenerativeProgress(
              withGenerativeTrimmingProgress(
                withGenerativeBottomPanelHidden(current.metadata),
                false
              )
            ),
            formatted
          ),
        }));
        toast.errorRaw(formatted.summary);
      }
    },
    [
      cloudConfigured,
      mediaKitInterfaceId,
      orgId,
      t,
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  const runGenerate = useCallback(async () => {
    if (
      !session ||
      session.loadPhase !== "ready" ||
      !session.trimSourceVideoUrl ||
      session.videoDurationSec === null ||
      !orgId ||
      !workflowId ||
      !updateNodeData ||
      isStartingTrim ||
      blocksGenerativeMedia
    ) {
      return;
    }

    if (session.highQuality) {
      if (!mediaKitTrimAvailable || !mediaKitInterfaceId) {
        toast.error("workflow.videoTrim.notConfiguredHint");
        return;
      }
      const sourceResourceId = getResourceIdFromValue(session.sourceMedia);
      if (!sourceResourceId || !isCloudStoredResource(session.sourceMedia)) {
        toast.error("workflow.videoTrim.sourceNotCloud");
        return;
      }
    } else if (!isWebCodecsVideoTrimSupported()) {
      toast.error("workflow.videoTrim.webCodecsUnsupported");
      return;
    }

    setIsStartingTrim(true);
    try {
      const shell = createTrimSiblingNodeShell();
      if (!shell) {
        toast.error("workflow.videoTrim.createNodeFailed");
        return;
      }

      if (!shell.referenceLinked) {
        toast.error("workflow.videoTrim.referenceLinkFailed");
      }

      const trimSourceVideoUrl = session.trimSourceVideoUrl;
      const trimRange = {
        startSec: session.committedRange.startSec,
        endSec: session.committedRange.endSec,
      };
      const targetNodeId = shell.nodeId;
      const highQuality = session.highQuality;
      const sourceResourceId = getResourceIdFromValue(session.sourceMedia);

      closeTrimSession();

      if (highQuality && sourceResourceId) {
        await runCloudTrim({
          targetNodeId,
          trimRange,
          sourceResourceId,
        });
      } else {
        runLocalTrim({
          targetNodeId,
          trimSourceVideoUrl,
          trimRange,
        });
      }
    } finally {
      setIsStartingTrim(false);
    }
  }, [
    blocksGenerativeMedia,
    closeTrimSession,
    createTrimSiblingNodeShell,
    isStartingTrim,
    mediaKitInterfaceId,
    mediaKitTrimAvailable,
    orgId,
    runCloudTrim,
    runLocalTrim,
    session,
    toast,
    updateNodeData,
    workflowId,
  ]);

  const handleGenerate = useCallback(async () => {
    if (
      !session ||
      session.loadPhase !== "ready" ||
      !session.trimSourceVideoUrl ||
      session.videoDurationSec === null ||
      !orgId ||
      !workflowId ||
      !updateNodeData ||
      isStartingTrim ||
      blocksGenerativeMedia
    ) {
      return;
    }

    const selectionDurationSec = videoTrimSelectionDurationSec(
      session.committedRange
    );
    if (
      shouldWarnVideoTrimShortDuration(selectionDurationSec) &&
      !readSkipVideoTrimShortDurationConfirm()
    ) {
      setShortDurationConfirmOpen(true);
      return;
    }

    await runGenerate();
  }, [
    blocksGenerativeMedia,
    isStartingTrim,
    orgId,
    runGenerate,
    session,
    updateNodeData,
    workflowId,
  ]);

  const handleShortDurationConfirm = useCallback(() => {
    if (shortDurationDontAsk) {
      writeSkipVideoTrimShortDurationConfirm(true);
    }
    setShortDurationConfirmOpen(false);
    void runGenerate();
  }, [runGenerate, shortDurationDontAsk]);

  if (!session || session.sourceNodeId !== nodeId) {
    return null;
  }

  const interfacesUrl = mediaKitInterfaceId
    ? getOrgUrl(`/ai-interfaces/${mediaKitInterfaceId}`)
    : getOrgUrl("/ai-interfaces");

  const ready =
    session.loadPhase === "ready" &&
    session.videoDurationSec !== null &&
    session.videoDurationSec > 0;

  const handleHighQualityToggle = (checked: boolean) => {
    if (checked && !mediaKitTrimAvailable) {
      setHighQualityHintOpen(true);
      return;
    }
    patchTrimSession({ highQuality: checked });
  };

  return (
    <>
      <GenerativeBottomPanelShell nodeId={nodeId} zoom={zoom}>
      <div className={VIDEO_TRIM_PANEL_RULER_ROW_CLASS}>
        {ready ? (
          <VideoTrimRuler
            videoDurationSec={session.videoDurationSec ?? 0}
            range={session.draftRange}
            onRangeChange={handleDraftRangeChange}
            onRangeCommit={handleRangeCommit}
          />
        ) : (
          <div className="h-9 min-w-0 flex-1 animate-pulse rounded-md bg-neutral-200/80 dark:bg-neutral-700/60" />
        )}
        <button
          type="button"
          aria-label={t("common.close")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-700/60"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            closeTrimSession();
          }}
        >
          <XIcon className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className={VIDEO_TRIM_PANEL_FOOTER_CLASS}>
        <div className={VIDEO_TRIM_PANEL_FOOTER_LEFT_CLASS}>
          <div className="flex items-center gap-0.5">
            <Popover
              modal={false}
              open={highQualityHintOpen}
              onOpenChange={setHighQualityHintOpen}
            >
              <PopoverAnchor asChild>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Switch
                    checked={session.highQuality}
                    disabled={!ready || isStartingTrim}
                    onCheckedChange={handleHighQualityToggle}
                  />
                  <span>{t("workflow.videoTrim.highQuality")}</span>
                </label>
              </PopoverAnchor>
              <PopoverContent
                className="w-64 p-3 text-sm"
                align="start"
                side="top"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="space-y-2">
                  <p>{t("workflow.videoTrim.notConfiguredHint")}</p>
                  <Link
                    to={interfacesUrl}
                    className="inline-block text-xs underline underline-offset-2"
                  >
                    {t("workflow.videoTrim.openAiInterfaces")}
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
            <VideoTrimLocalTrimHintIcon />
          </div>
        </div>

        <div className={VIDEO_TRIM_PANEL_FOOTER_CENTER_CLASS}>
          {ready ? (
            <VideoTrimTimeFields
              videoDurationSec={session.videoDurationSec ?? 0}
              range={session.draftRange}
              disabled={isStartingTrim}
              onRangeChange={handleDraftRangeChange}
              onRangeCommit={handleRangeCommit}
            />
          ) : session.loadPhase === "error" ? (
            <p className="text-xs text-destructive">{t("workflow.videoTrim.loadFailed")}</p>
          ) : (
            <div className="h-7 w-40 animate-pulse rounded bg-neutral-200/80 dark:bg-neutral-700/60" />
          )}
        </div>

        <div className={VIDEO_TRIM_PANEL_FOOTER_ACTIONS_CLASS}>
          <button
            type="button"
            disabled={!ready || isStartingTrim}
            aria-label={
              session.playbackPaused
                ? t("workflow.videoTrim.play")
                : t("workflow.videoTrim.pause")
            }
            className={VIDEO_TRIM_PANEL_ACTION_BUTTON_CLASS}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setPlaybackPaused(!session.playbackPaused);
            }}
          >
            {session.playbackPaused ? (
              <PlayIcon className="size-4" strokeWidth={2} />
            ) : (
              <PauseIcon className="size-4" strokeWidth={2} />
            )}
          </button>

          <button
            type="button"
            disabled={!ready || isStartingTrim}
            className={VIDEO_TRIM_PANEL_PRIMARY_BUTTON_CLASS}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void handleGenerate();
            }}
          >
            {isStartingTrim ? (
              <LoaderIcon className="size-4 animate-spin" strokeWidth={2} />
            ) : null}
            <span>{t("workflow.videoTrim.action")}</span>
          </button>
        </div>
      </div>
      </GenerativeBottomPanelShell>

      <VideoTrimShortDurationConfirmDialog
        open={shortDurationConfirmOpen}
        dontAskAgain={shortDurationDontAsk}
        onDontAskAgainChange={setShortDurationDontAsk}
        onOpenChange={setShortDurationConfirmOpen}
        onConfirm={handleShortDurationConfirm}
      />
    </>
  );
}
