import {
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODEL_VERSION_LABEL_KEYS,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_OUTPUT_ENCODE_MODE_LABEL_KEYS,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_SCOPE_LABEL_KEYS,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_SCOPES,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODEL_VERSIONS,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_OUTPUT_ENCODE_MODES,
  withVideoSubtitleEraseNodeConfig,
  withVideoSubtitleEraseRefinedDefaults,
  type VideoSubtitleEraseNodeConfig,
  type VolcanoMediaKitSubtitleEraseModelVersion,
  type VolcanoMediaKitSubtitleEraseOutputEncodeMode,
  type VolcanoMediaKitSubtitleEraseScope,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import LoaderIcon from "lucide-react/icons/loader";
import RotateCcwIcon from "lucide-react/icons/rotate-ccw";
import SquareDashedIcon from "lucide-react/icons/square-dashed";
import XIcon from "lucide-react/icons/x";
import { useNodes, useViewport } from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  getGenerationJob,
  submitVideoSubtitleErase,
} from "@/services/platform-ai-model-service";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import {
  releaseGenerativeJobResume,
  tryClaimGenerativeJobFinalize,
  tryClaimGenerativeJobResume,
} from "@/services/generative-cloud-job-resume-registry";
import { resolveCloudGenerationJobMedia } from "@/services/persist-generative-media-from-url";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useDismissOnCanvasPointerDown } from "@/hooks/use-dismiss-on-canvas-pointer-down";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import {
  appendAiVideoGeneratedHistoryItems,
  withAiVideoGenerateError,
  withAiVideoGeneratingFlag,
} from "./ai-video-node-utils";
import { cn } from "@/utils/utils";
import { withGenerativeBottomPanelHidden } from "./generative-card-mode-utils";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import {
  clearGenerativeProgress,
  withGenerativeProgress,
} from "./generative-progress-utils";
import { GenerativeBottomPanelShell } from "./generative-bottom-panel-shell";
import { useVideoSubtitleEraseToSiblingNode } from "./use-video-subtitle-erase-to-sibling-node";
import {
  readVideoEnhanceSourceResourceId,
  type VideoEnhanceSourceGraphContext,
} from "./video-enhance-node-utils";
import { useSubtitleEraseSession } from "./video-subtitle-erase-session-context";
import { useWorkflow, useWorkflowGraph } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";
import { VIDEO_TRIM_PANEL_PRIMARY_BUTTON_CLASS } from "./video-trim-panel-styles";

export interface AiVideoSubtitleEraseConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

const SELECT_TRIGGER_CLASS =
  "h-7 w-auto min-w-[5.5rem] max-w-[9rem] border-0 bg-muted/40 px-2 text-xs shadow-none focus:ring-0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type OpenParamSelect =
  | "modelVersion"
  | "eraseScope"
  | "outputEncodeMode"
  | null;

function InlineParamSelect({
  open,
  onOpenChange,
  value,
  options,
  renderLabel,
  disabled,
  onChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly value: string;
  readonly options: readonly string[];
  readonly renderLabel: (value: string) => string;
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      open={open}
      disabled={disabled}
      onOpenChange={onOpenChange}
      onValueChange={onChange}
    >
      <SelectTrigger className={SELECT_TRIGGER_CLASS}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="text-xs">
            {renderLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AiVideoSubtitleEraseConfigPanel({
  nodeId,
  data,
}: AiVideoSubtitleEraseConfigPanelProps) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { updateNodeData, disabled } = useWorkflow();
  const { edges } = useWorkflowGraph();
  const nodes = useNodes();
  const { zoom } = useViewport();
  const subtitleErase = useSubtitleEraseSession();
  const { createSubtitleEraseSiblingNodeShell } =
    useVideoSubtitleEraseToSiblingNode(nodeId);
  const { interfaceId: mediaKitInterfaceId, config: mediaKitConfig } =
    useOrgVolcanoMediaKitConfig(orgId);

  const [isStarting, setIsStarting] = useState(false);
  const [openSelect, setOpenSelect] = useState<OpenParamSelect>(null);
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();

  useDismissOnCanvasPointerDown(openSelect !== null, () => setOpenSelect(null));

  const session = subtitleErase.session;
  const active = session?.sourceNodeId === nodeId;

  const enabledModes = mediaKitConfig?.enabledSubtitleEraseModes ?? [];

  const graphContext = useMemo<VideoEnhanceSourceGraphContext>(
    () => ({
      nodeId,
      edges,
      nodes: nodes.map((node) => ({
        id: node.id,
        data: node.data as WorkflowNodeType,
      })),
    }),
    [edges, nodeId, nodes]
  );

  const sourceResourceId = useMemo(
    () => readVideoEnhanceSourceResourceId(data, graphContext),
    [data, graphContext]
  );

  const draftConfig: VideoSubtitleEraseNodeConfig | null = useMemo(
    () =>
      session && active
        ? withVideoSubtitleEraseRefinedDefaults(session.draftConfig)
        : null,
    [active, session]
  );

  const regions = session?.regions ?? [];

  const applyConfig = useCallback(
    (next: VideoSubtitleEraseNodeConfig) => {
      subtitleErase.patchDraftConfig(next);
      if (!updateNodeData) {
        return;
      }
      updateNodeData(nodeId, (current) => ({
        ...current,
        metadata: withVideoSubtitleEraseNodeConfig(current.metadata, next),
      }));
    },
    [nodeId, subtitleErase, updateNodeData]
  );

  const handleGenerate = useCallback(async () => {
    if (
      !session ||
      !active ||
      isStarting ||
      disabled ||
      !orgId ||
      !workflowId ||
      !mediaKitInterfaceId ||
      !draftConfig
    ) {
      return;
    }
    if (!mediaKitConfig?.active || enabledModes.length === 0) {
      toast.error("workflow.subtitleErase.notConfigured");
      return;
    }
    if (!sourceResourceId) {
      toast.error("workflow.subtitleErase.sourceMissing");
      return;
    }

    const effectiveConfig = withVideoSubtitleEraseRefinedDefaults(
      session.draftConfig
    );
    setIsStarting(true);
    let targetNodeId: string | null = null;
    try {
      const shell = createSubtitleEraseSiblingNodeShell();
      if (!shell) {
        toast.error("workflow.subtitleErase.createNodeFailed");
        return;
      }
      if (!shell.referenceLinked) {
        toast.error("workflow.subtitleErase.referenceLinkFailed");
      }
      targetNodeId = shell.nodeId;
      subtitleErase.closeSubtitleEraseSession();

      const writeBusyMetadata = (jobId?: string) => {
        updateNodeData?.(shell.nodeId, (current) => ({
          metadata: withGenerativeProgress(
            withAiVideoGeneratingFlag(
              withGenerativeBottomPanelHidden(current.metadata),
              true
            ),
            jobId ? { jobId, phase: "generating" } : { phase: "generating" }
          ),
        }));
      };

      writeBusyMetadata();

      const clientRequestId = crypto.randomUUID();
      const response = await submitVideoSubtitleErase(orgId, {
        aiInterfaceId: mediaKitInterfaceId,
        sourceVideoResourceId: sourceResourceId,
        mode: effectiveConfig.mode,
        ...(effectiveConfig.mode === "refined"
          ? {
              eraseMode: effectiveConfig.eraseMode,
              modelVersion: effectiveConfig.modelVersion,
              outputEncodeMode: effectiveConfig.outputEncodeMode,
              ...(effectiveConfig.eraseRatioLocation?.length
                ? { eraseRatioLocation: effectiveConfig.eraseRatioLocation }
                : {}),
            }
          : {}),
        workflowId,
        nodeId: shell.nodeId,
        clientRequestId,
      });

      if (response.workflowNodeContent && updateNodeData) {
        updateNodeData(shell.nodeId, (current) => ({
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
      } else {
        writeBusyMetadata(response.jobId);
      }

      if (!response.jobId) {
        throw new Error(t("workflow.subtitleErase.submitFailed"));
      }

      const jobId = response.jobId;
      const claimed = tryClaimGenerativeJobResume(jobId);
      let media: readonly WorkflowMediaValue[];
      try {
        if (!claimed) {
          while (true) {
            const jobResponse = await getGenerationJob(orgId, jobId);
            if (jobResponse.job.status === "succeeded") {
              media = jobResponse.finalMedia ?? [];
              break;
            }
            if (
              jobResponse.job.status === "failed" ||
              jobResponse.job.status === "cancelled"
            ) {
              throw new Error(
                jobResponse.job.failureReason ??
                  t("workflow.subtitleErase.submitFailed")
              );
            }
            await sleep(VIDEO_JOB_CLIENT_POLL_INTERVAL_MS);
          }
        } else {
          media = await resolveCloudGenerationJobMedia({
            organizationId: orgId,
            jobId,
            workflowId,
            cloudConfigured,
            onProgressPhase: (phase) => {
              updateNodeData?.(shell.nodeId, (current) => ({
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
        throw new Error(t("workflow.subtitleErase.submitFailed"));
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

      if (updateNodeData) {
        updateNodeData(shell.nodeId, (current) => {
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

          const withResult = appendAiVideoGeneratedHistoryItems(
            current,
            media,
            {
              prompt: "",
              params: {
                ...effectiveConfig,
              } as Readonly<Record<string, unknown>>,
              aiInterfaceId: mediaKitInterfaceId,
              jobId,
            }
          );
          return {
            ...withResult,
            metadata: withAiVideoGenerateError(
              withAiVideoGeneratingFlag(
                withGenerativeBottomPanelHidden(
                  clearGenerativeProgress(withResult.metadata)
                ),
                false
              ),
              null
            ),
          };
        });
      }

      if (canWriteHistory) {
        toast.success("workflow.aiVideoPanel.generated");
      }
    } catch (error) {
      toast.errorRaw(
        error instanceof Error
          ? error.message
          : t("workflow.subtitleErase.submitFailed")
      );
      if (targetNodeId && updateNodeData) {
        updateNodeData(targetNodeId, (current) => ({
          metadata: clearGenerativeProgress(
            withAiVideoGenerateError(current.metadata, "submit_failed")
          ),
        }));
      }
    } finally {
      setIsStarting(false);
    }
  }, [
    cloudConfigured,
    createSubtitleEraseSiblingNodeShell,
    disabled,
    draftConfig,
    enabledModes.length,
    mediaKitConfig?.active,
    mediaKitInterfaceId,
    isStarting,
    nodeId,
    orgId,
    session,
    sourceResourceId,
    subtitleErase,
    t,
    toast,
    updateNodeData,
    workflowId,
    active,
  ]);

  if (!active || !session || !draftConfig) {
    return null;
  }

  const refined = draftConfig.mode === "refined";

  return (
    <GenerativeBottomPanelShell nodeId={nodeId} zoom={zoom} widthPx={420}>
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          aria-label={t("common.close")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-700/60"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            subtitleErase.closeSubtitleEraseSession();
          }}
        >
          <XIcon className="size-3.5" strokeWidth={2} />
        </button>
        <div className="h-6 w-px shrink-0 bg-border-muted" />
        <span className="whitespace-nowrap text-[13px] text-foreground">
          {t("workflow.subtitleErase.action")}
        </span>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <span>{t("workflow.subtitleErase.refinedToggle")}</span>
          <Switch
            checked={refined}
            disabled={isStarting}
            onCheckedChange={(checked) => {
              if (!checked) {
                subtitleErase.setRegionMode(false);
              }
              applyConfig({
                ...draftConfig,
                mode: checked ? "refined" : "standard",
              });
            }}
          />
        </label>
        <div className="min-w-2 flex-1" />
        <button
          type="button"
          disabled={isStarting || !sourceResourceId || disabled}
          className={VIDEO_TRIM_PANEL_PRIMARY_BUTTON_CLASS}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void handleGenerate();
          }}
        >
          {isStarting ? (
            <LoaderIcon className="size-4 animate-spin" strokeWidth={2} />
          ) : null}
          <span>{t("workflow.subtitleErase.generate")}</span>
        </button>
      </div>

      {refined ? (
        <div className="border-t border-border/60">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <InlineParamSelect
              open={openSelect === "modelVersion"}
              onOpenChange={(open) =>
                setOpenSelect(open ? "modelVersion" : null)
              }
              value={draftConfig.modelVersion ?? "v5"}
              options={[...VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODEL_VERSIONS]}
              renderLabel={(version) =>
                t(
                  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODEL_VERSION_LABEL_KEYS[
                    version as VolcanoMediaKitSubtitleEraseModelVersion
                  ]
                )
              }
              disabled={isStarting}
              onChange={(modelVersion) =>
                applyConfig({
                  ...draftConfig,
                  modelVersion:
                    modelVersion as VolcanoMediaKitSubtitleEraseModelVersion,
                })
              }
            />
            <InlineParamSelect
              open={openSelect === "eraseScope"}
              onOpenChange={(open) => setOpenSelect(open ? "eraseScope" : null)}
              value={draftConfig.eraseMode ?? "subtitle"}
              options={[...VOLCANO_MEDIKIT_SUBTITLE_ERASE_SCOPES]}
              renderLabel={(scope) =>
                t(
                  VOLCANO_MEDIKIT_SUBTITLE_ERASE_SCOPE_LABEL_KEYS[
                    scope as VolcanoMediaKitSubtitleEraseScope
                  ]
                )
              }
              disabled={isStarting}
              onChange={(eraseMode) =>
                applyConfig({
                  ...draftConfig,
                  eraseMode: eraseMode as VolcanoMediaKitSubtitleEraseScope,
                })
              }
            />
            <InlineParamSelect
              open={openSelect === "outputEncodeMode"}
              onOpenChange={(open) =>
                setOpenSelect(open ? "outputEncodeMode" : null)
              }
              value={draftConfig.outputEncodeMode ?? "quality"}
              options={[...VOLCANO_MEDIKIT_SUBTITLE_ERASE_OUTPUT_ENCODE_MODES]}
              renderLabel={(encodeMode) =>
                t(
                  VOLCANO_MEDIKIT_SUBTITLE_ERASE_OUTPUT_ENCODE_MODE_LABEL_KEYS[
                    encodeMode as VolcanoMediaKitSubtitleEraseOutputEncodeMode
                  ]
                )
              }
              disabled={isStarting}
              onChange={(outputEncodeMode) =>
                applyConfig({
                  ...draftConfig,
                  outputEncodeMode:
                    outputEncodeMode as VolcanoMediaKitSubtitleEraseOutputEncodeMode,
                })
              }
            />
          </div>

          <div className="flex items-center gap-1 border-t border-border/60 px-3 py-1.5">
            <button
              type="button"
              aria-label={t("workflow.subtitleErase.regionModeToggle")}
              aria-pressed={session.regionMode}
              disabled={isStarting}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-lg transition-colors",
                session.regionMode
                  ? "border border-foreground/25 bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                subtitleErase.setRegionMode(!session.regionMode);
              }}
            >
              <SquareDashedIcon className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label={t("workflow.subtitleErase.regionReset")}
              disabled={isStarting || regions.length === 0}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                subtitleErase.setRegions([]);
              }}
            >
              <RotateCcwIcon className="size-4" strokeWidth={2} />
            </button>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {t("workflow.subtitleErase.regionModeHint")}
            </span>
          </div>
        </div>
      ) : null}
    </GenerativeBottomPanelShell>
  );
}
