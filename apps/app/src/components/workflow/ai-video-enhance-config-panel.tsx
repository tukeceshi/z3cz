import {
  hasVideoEnhancePendingAutoSubmit,
  parseVideoEnhanceNodeConfig,
  withVideoEnhanceNodeConfig,
  withoutVideoEnhancePendingAutoSubmit,
  type VideoEnhanceNodeConfig,
} from "@dafthunk/types";
import { useNodes, useViewport } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { submitVideoEnhance } from "@/services/platform-ai-model-service";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { useGenerativeCloudJobProgress, generativeVideoProgressButtonKey } from "@/hooks/use-generative-cloud-job";
import type { PersistGenerativeMediaPhase } from "@/services/persist-generative-media-from-url";

import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";
import { AiVideoEnhanceAttachedPanelShell } from "./ai-video-enhance-attached-panel-shell";
import { AI_VIDEO_ENHANCE_PANEL_ACTIONS_CLASS } from "./ai-video-enhance-panel-styles";
import {
  AiVideoEnhanceSettingsPanel,
  createDefaultVideoEnhanceConfig,
} from "./ai-video-enhance-settings-panel";
import { AiGenerateButton } from "./ai-generate-button";
import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import {
  appendAiVideoGeneratedHistoryItems,
  withAiVideoGeneratingFlag,
  withAiVideoGenerateError,
} from "./ai-video-node-utils";
import {
  clearGenerativeProgress,
  formatGenerativeBusyOverlayLabel,
  withGenerativeProgress,
} from "./generative-progress-utils";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useWorkflow, useWorkflowGraph } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";
import { readVideoEnhanceSourceResourceId } from "./video-enhance-node-utils";

export interface AiVideoEnhanceConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly layout?: GenerativeConfigPanelLayout;
}

function getInputString(data: WorkflowNodeType, id: string): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}

export function AiVideoEnhanceConfigPanel({
  nodeId,
  data,
  layout = "attached",
}: AiVideoEnhanceConfigPanelProps) {
  const { updateNodeData, disabled } = useWorkflow();
  const { edges } = useWorkflowGraph();
  const nodes = useNodes();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const toast = useAppToast();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();

  const aiInterfaceId = getInputString(data, "ai_interface_id");
  const {
    interfaceId: mediaKitInterfaceId,
    config: mediaKitConfig,
  } = useOrgVolcanoMediaKitConfig(orgId);

  const parsedConfig = useMemo(
    () => parseVideoEnhanceNodeConfig(data.metadata),
    [data.metadata]
  );

  const [draftConfig, setDraftConfig] = useState<VideoEnhanceNodeConfig | null>(
    parsedConfig
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [persistPhase, setPersistPhase] = useState<PersistGenerativeMediaPhase | null>(
    null
  );
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
  const generateInFlightRef = useRef(false);
  const autoSubmitAttemptedRef = useRef(false);

  useEffect(() => {
    setDraftConfig(parsedConfig);
  }, [parsedConfig]);

  useEffect(() => {
    autoSubmitAttemptedRef.current = false;
  }, [nodeId]);

  const enabledModes = mediaKitConfig?.enabledVideoModes ?? [];

  useEffect(() => {
    if (!draftConfig && enabledModes.length > 0) {
      const defaults = createDefaultVideoEnhanceConfig(enabledModes);
      if (defaults) {
        setDraftConfig(defaults);
      }
    }
  }, [draftConfig, enabledModes]);

  const { resolveJobMedia, activeProgressPhase, clearProgress } =
    useGenerativeCloudJobProgress({
      nodeId,
      orgId,
      workflowId,
      cloudConfigured,
      metadata: data.metadata,
      isGenerating,
      persistPhase,
      autoResume: true,
      updateNodeData,
      setPersistPhase,
      setIsGenerating,
      applyBusyMetadata: (metadata, busy) =>
        withAiVideoGeneratingFlag(metadata, busy),
      onResumeSuccess: (result) => {
        if (!updateNodeData || result.media.length === 0) {
          return;
        }
        updateNodeData(nodeId, (current) =>
          appendAiVideoGeneratedHistoryItems(current, result.media, {
            prompt: "",
            params: draftConfig ?? undefined,
            aiInterfaceId,
          })
        );
      },
    });

  useEffect(() => {
    if (!activeProgressPhase) {
      return;
    }
    const timerId = window.setInterval(() => {
      setProgressNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [activeProgressPhase]);

  const handleConfigChange = useCallback(
    (next: VideoEnhanceNodeConfig) => {
      setDraftConfig(next);
      if (!updateNodeData) {
        return;
      }
      updateNodeData(nodeId, (current) => ({
        ...current,
        metadata: withVideoEnhanceNodeConfig(current.metadata, next),
      }));
    },
    [nodeId, updateNodeData]
  );

  const handleGenerate = useCallback(async () => {
    if (
      generateInFlightRef.current ||
      disabled ||
      !orgId ||
      !workflowId ||
      !draftConfig ||
      !mediaKitInterfaceId
    ) {
      return;
    }

    const sourceResourceId = readVideoEnhanceSourceResourceId(data, {
      nodeId,
      edges,
      nodes: nodes.map((node) => ({
        id: node.id,
        data: node.data as WorkflowNodeType,
      })),
    });
    if (!sourceResourceId) {
      toast.error("workflow.videoEnhance.sourceMissing");
      return;
    }

    if (!mediaKitConfig?.active || enabledModes.length === 0) {
      toast.error("workflow.videoEnhance.notConfigured");
      return;
    }

    generateInFlightRef.current = true;
    setIsGenerating(true);
    updateNodeData?.(nodeId, (current) => ({
      metadata: withGenerativeProgress(
        withAiVideoGeneratingFlag(current.metadata, true),
        { phase: "generating" }
      ),
    }));

    const clientRequestId = crypto.randomUUID();

    try {
      const response = await submitVideoEnhance(orgId, {
        aiInterfaceId: mediaKitInterfaceId,
        sourceVideoResourceId: sourceResourceId,
        mode: draftConfig.mode,
        resolution: draftConfig.resolution,
        fps: draftConfig.fps,
        workflowId,
        nodeId,
        clientRequestId,
      });

      if (response.workflowNodeContent && updateNodeData) {
        updateNodeData(nodeId, (current) => ({
          ...applyWorkflowNodeContentPatch(current, response.workflowNodeContent!),
          metadata: withGenerativeProgress(
            withAiVideoGeneratingFlag(current.metadata, true),
            { jobId: response.jobId, phase: "generating" }
          ),
        }));
      }

      if (response.jobId) {
        const resolvedJob = await resolveJobMedia(response.jobId);
        if (!resolvedJob.owned) {
          if (resolvedJob.media.length === 0) {
            throw new Error(
              t("workflow.videoEnhance.submitFailed")
            );
          }
          setPersistPhase(null);
          clearProgress();
          return;
        }
        if (resolvedJob.media.length === 0) {
          throw new Error("Video enhance succeeded without a playable reference");
        }

        const canWriteHistory = tryClaimGenerativeJobFinalize(response.jobId);
        if (canWriteHistory && workflowId && orgId) {
          persistMediaForNodeInBackground({
            organizationId: orgId,
            workflowId,
            media: resolvedJob.media,
            nodeType: "ai-video",
            cloudConfigured,
          });
        }

        if (updateNodeData) {
          updateNodeData(nodeId, (current) => {
            if (!canWriteHistory) {
              return {
                metadata: withAiVideoGenerateError(
                  withAiVideoGeneratingFlag(
                    clearGenerativeProgress(current.metadata),
                    false
                  ),
                  null
                ),
              };
            }

            const withResult = appendAiVideoGeneratedHistoryItems(
              current,
              resolvedJob.media,
              {
                prompt: "",
                params: draftConfig,
                aiInterfaceId: mediaKitInterfaceId,
                jobId: response.jobId,
              }
            );
            return {
              ...withResult,
              metadata: withAiVideoGenerateError(
                withAiVideoGeneratingFlag(
                  clearGenerativeProgress(withResult.metadata),
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
        setPersistPhase(null);
        clearProgress();
      }
    } catch (error) {
      toast.errorRaw(
        error instanceof Error ? error.message : t("workflow.videoEnhance.submitFailed")
      );
      if (updateNodeData) {
        updateNodeData(nodeId, (current) => ({
          ...current,
          metadata: clearGenerativeProgress(
            withAiVideoGenerateError(current.metadata, "submit_failed")
          ),
        }));
      }
    } finally {
      generateInFlightRef.current = false;
      setIsGenerating(false);
    }
  }, [
    clearProgress,
    cloudConfigured,
    data,
    disabled,
    draftConfig,
    edges,
    enabledModes.length,
    mediaKitConfig?.active,
    mediaKitInterfaceId,
    nodeId,
    nodes,
    orgId,
    resolveJobMedia,
    t,
    toast,
    updateNodeData,
    workflowId,
  ]);

  const isBusy = isGenerating || Boolean(activeProgressPhase);
  const progressButtonLabel = useMemo(() => {
    if (!activeProgressPhase && !isGenerating) {
      return t("workflow.videoEnhance.generate");
    }
    const phase = activeProgressPhase ?? "generating";
    return formatGenerativeBusyOverlayLabel({
      phase,
      progressButtonKey: generativeVideoProgressButtonKey,
      i18nPrefix: "workflow.aiVideoPanel",
      metadata: data.metadata,
      progressNowMs,
      t,
    });
  }, [activeProgressPhase, data.metadata, isGenerating, progressNowMs, t]);

  const sourceResourceId = useMemo(
    () =>
      readVideoEnhanceSourceResourceId(data, {
        nodeId,
        edges,
        nodes: nodes.map((node) => ({
          id: node.id,
          data: node.data as WorkflowNodeType,
        })),
      }),
    [data, edges, nodeId, nodes]
  );

  const canGenerate =
    Boolean(draftConfig) &&
    enabledModes.length > 0 &&
    Boolean(sourceResourceId) &&
    !disabled &&
    !isBusy;

  useEffect(() => {
    if (
      autoSubmitAttemptedRef.current ||
      !hasVideoEnhancePendingAutoSubmit(data.metadata) ||
      !draftConfig ||
      !sourceResourceId ||
      disabled ||
      isBusy ||
      !mediaKitInterfaceId ||
      !mediaKitConfig?.active ||
      enabledModes.length === 0
    ) {
      return;
    }

    autoSubmitAttemptedRef.current = true;
    updateNodeData?.(nodeId, (current) => ({
      ...current,
      metadata: withoutVideoEnhancePendingAutoSubmit(current.metadata),
    }));
    void handleGenerate();
  }, [
    data.metadata,
    disabled,
    draftConfig,
    enabledModes.length,
    handleGenerate,
    isBusy,
    mediaKitConfig?.active,
    mediaKitInterfaceId,
    nodeId,
    sourceResourceId,
    updateNodeData,
  ]);

  if (!draftConfig || enabledModes.length === 0) {
    return null;
  }

  const panelContent = (
    <>
      <AiVideoEnhanceSettingsPanel
        enabledModes={enabledModes}
        value={draftConfig}
        disabled={disabled || isBusy}
        onChange={handleConfigChange}
      />
      <div className={AI_VIDEO_ENHANCE_PANEL_ACTIONS_CLASS}>
        <AiGenerateButton
          disabled={!canGenerate}
          isGenerating={isBusy}
          isCancelling={false}
          canCancel={false}
          label={progressButtonLabel}
          cancelLabel={t("workflow.generativeCancel.action")}
          onClick={() => {
            void handleGenerate();
          }}
          onCancel={() => {}}
        />
      </div>
    </>
  );

  if (layout === "attached") {
    return (
      <AiVideoEnhanceAttachedPanelShell nodeId={nodeId} zoom={zoom}>
        {panelContent}
      </AiVideoEnhanceAttachedPanelShell>
    );
  }

  return (
    <GenerativeConfigPanelShell nodeId={nodeId} zoom={zoom} layout={layout}>
      <div className="flex h-full flex-col">{panelContent}</div>
    </GenerativeConfigPanelShell>
  );
}
