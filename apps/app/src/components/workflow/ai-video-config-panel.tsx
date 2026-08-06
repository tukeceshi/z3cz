import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  createEphemeralMediaExpiresAt,
  mergeImageGenerationParams,
  normalizeVideoModelParameterRules,
  type EphemeralMediaReference,
  type LocalMediaReference,
  type MediaReference,
  type ObjectReference,
  type OrgTextModelOption,
  type OrgVideoModelOption,
} from "@dafthunk/types";
import {
  useNodes,
  useReactFlow,
  useViewport,
  type Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { cn } from "@/utils/utils";
import {
  pollAiVideoTask,
  submitAiVideo,
  useOrgVideoModels,
} from "@/services/platform-ai-model-service";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { useObjectService } from "@/services/object-service";
import { ensureGenerativeMediaCached } from "@/services/stage-generative-media";
import { resolveMediaFetchUrl } from "@/services/media-url-resolver";
import { resolveMediaReferencesForVideoGenerate } from "@/services/resolve-references-for-generate";
import { uploadGenerativeMedia } from "@/services/upload-generative-media";
import {
  type PersistGenerativeMediaPhase,
} from "@/services/persist-generative-media-from-url";
import { readActiveGenerationJobId } from "@/services/read-active-generation-job-id";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";

import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";
import {
  shouldShowStudioPromptBox,
  studioDockSizeForPanel,
} from "./generative-studio-dock-layout";
import { useOpenCreativeStudio } from "./creative-studio-context";
import {
  clearGenerativeProgress,
  formatGenerativeProgressElapsed,
  readGenerativeProgressStartedAt,
  withGenerativeProgress,
} from "./generative-progress-utils";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import {
  collectGenerativeReferenceMedia,
  connectGenerativeReferenceEdge,
} from "./generative-reference-utils";
import { AiGenerateButton } from "./ai-generate-button";
import {
  AiTextExpandButton,
} from "./ai-text-expand-overlay";
import { AiTextModelPicker } from "./ai-text-model-picker";
import { useGenerativeModelCard } from "./use-generative-model-card";
import { persistModelBindingToInputs } from "./org-model-selection-utils";
import {
  AiTextReferenceBar,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import {
  AiVideoParamsPopover,
  buildDefaultVideoGenerationParams,
} from "./ai-video-params-popover";
import {
  annotateVideoReferenceChips,
  clearReferenceModeAutoSwitchNoticeIfResolved,
  resolveEffectiveVideoReferenceMode,
  shouldShowReferenceModeAutoSwitchNotice,
  syncVideoReferenceModeIfNeeded,
} from "./ai-video-reference-mode";
import {
  readNodeGenerationParams,
  sanitizeCardGenerationParams,
} from "./generative-card-params";
import {
  AI_IMAGE_OUTPUT_ID,
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_PANEL_PROMPT_MIN_HEIGHT_PX,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
  countAiVideoReferenceCounts,
  canGenerateAiVideo,
  referencesFitVideoModelLimits,
  appendAiVideoGeneratedHistoryItems,
  withAiVideoStagingPreview,
  withAiVideoGeneratingFlag,
  withAiVideoGenerateError,
} from "./ai-video-node-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { generativePromptWithinModelLimit } from "./generative-card-upload-utils";
import {
  resolveGenerativeNodeDefaultBaseName,
  resolveGenerativeNodeDisplayName,
} from "./generative-node-naming";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import {
  canAcceptAiVideoReference,
  evaluateAiVideoReferenceStructural,
  listPickableAiVideoReferenceSources,
  resolveAiVideoReferenceRules,
} from "./ai-video-reference-policy";
import {
  hasAiVideoPromptReference,
  listPickableAiVideoPromptSources,
  resolveAiVideoReferencedPrompt,
  evaluateAiVideoPromptReferenceStructural,
  collectAiVideoUnifiedReferenceChips,
} from "./ai-video-prompt-reference";
import { useBufferedTextValue } from "./use-buffered-text-value";
import {
  useGenerativeCloudJobProgress,
  generativeVideoProgressButtonKey,
} from "@/hooks/use-generative-cloud-job";
import { updateNodeInput, upsertNodeInputValues, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_POLL_MAX_ATTEMPTS = 120;

export interface AiVideoConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly layout?: GenerativeConfigPanelLayout;
}

function getInputString(data: WorkflowNodeType, id: string): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}

function createEphemeralVideoReference(videoUrl: string): EphemeralMediaReference {
  return {
    kind: "ephemeral",
    url: videoUrl,
    mimeType: "video/mp4",
    mediaId: `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: createEphemeralMediaExpiresAt(),
  };
}

async function pollUntilVideoReady(
  orgId: string,
  taskId: string,
  aiInterfaceId: string,
  modelCanonicalId: string,
  workflowId: string | undefined,
  onPhase?: (phase: "queued" | "generating") => void
): Promise<MediaReference> {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    const result = await pollAiVideoTask(orgId, taskId, aiInterfaceId, {
      workflowId,
      modelCanonicalId,
    });
    if (result.status === "succeeded") {
      const stored = result.videos?.[0];
      if (stored) {
        return stored;
      }
      if (result.videoUrl) {
        return createEphemeralVideoReference(result.videoUrl);
      }
      throw new Error("Video generation succeeded without a playable reference");
    }
    if (result.status === "failed" || result.status === "expired" || result.status === "cancelled") {
      throw new Error(result.error ?? "Video generation failed");
    }
    if (result.status === "queued") {
      onPhase?.("queued");
    } else {
      onPhase?.("generating");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, VIDEO_POLL_INTERVAL_MS);
    });
  }
  throw new Error("Video generation timed out");
}

export function AiVideoConfigPanel({
  nodeId,
  data,
  layout = "attached",
}: AiVideoConfigPanelProps) {
  const {
    updateNodeData,
    disabled,
    edges = [],
    deleteEdge,
    nodeTypes = [],
  } = useWorkflow();
  const nodes = useNodes();
  const { setNodes, setEdges, getNode } = useReactFlow();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const toast = useAppToast();
  const { getOrgUrl } = useOrgUrl();
  const { createObjectUrl } = useObjectService();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();

  const resolveMediaPreviewUrl = useCallback(
    (media: MediaReference) =>
      orgId ? resolveMediaFetchUrl(media, orgId) : null,
    [createObjectUrl, orgId]
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const generateInFlightRef = useRef(false);
  const [persistPhase, setPersistPhase] = useState<PersistGenerativeMediaPhase | null>(
    null
  );
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
  const [pickNodeOpen, setPickNodeOpen] = useState(false);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);

  const promptValue = getInputString(data, "prompt");
  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];

  const hasPromptReference = useMemo(
    () => hasAiVideoPromptReference({ nodeId, edges }),
    [edges, nodeId]
  );

  const referencedPrompt = useMemo(
    () =>
      resolveAiVideoReferencedPrompt({
        nodeId,
        edges,
        nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      }),
    [edges, nodeId, typedNodes]
  );

  const referenceCounts = useMemo(
    () =>
      countAiVideoReferenceCounts(
        nodeId,
        edges,
        typedNodes.map((node) => ({ id: node.id, data: node.data }))
      ),
    [edges, nodeId, typedNodes]
  );

  const modelFitsCurrentRefs = useCallback(
    (model: OrgVideoModelOption) =>
      referencesFitVideoModelLimits(
        referenceCounts,
        normalizeVideoModelParameterRules(model.parameterRules)
      ),
    [referenceCounts]
  );

  const {
    effectiveModel,
    selectedOptionId,
    models,
    groups,
    isLoading,
    modelsError,
    canGenerate: modelReady,
    handlePickerOpenChange,
    applyModelSelection,
    refreshModels,
    nodeInputs,
    cardGenerationParams,
  } = useGenerativeModelCard({
    orgId,
    modality: "video",
    data,
    nodeId,
    disabled,
    updateNodeData,
    readModelId: (nodeData) => getInputString(nodeData, "model"),
    readInterfaceId: (nodeData) => getInputString(nodeData, "ai_interface_id"),
    readGenerationFields: (model) =>
      normalizeVideoModelParameterRules(model.parameterRules).generationFields,
    buildDefaultParams: buildDefaultVideoGenerationParams,
    useModels: useOrgVideoModels,
    modelFitsCurrentRefs,
    onModelSelected: (model, current) => {
      const rules = normalizeVideoModelParameterRules(model.parameterRules);
      const defaultParams = buildDefaultVideoGenerationParams(
        rules.generationFields
      );
      return {
        inputs: upsertNodeInputValues(
          persistModelBindingToInputs(current.inputs, {
            canonicalId: model.canonicalId,
            interfaceId: model.interfaceId,
          }),
          { params: defaultParams },
          { params: "json" }
        ),
      };
    },
  });

  const videoModelCatalog = useMemo(
    () =>
      models.map((entry) => ({
        canonicalId: entry.canonicalId,
        parameterRules: entry.parameterRules,
      })),
    [models]
  );

  const modelRules = useMemo(() => {
    if (effectiveModel) {
      return normalizeVideoModelParameterRules(effectiveModel.parameterRules);
    }
    return resolveAiVideoReferenceRules({
      targetNodeData: data,
      models: videoModelCatalog,
    });
  }, [data, effectiveModel, videoModelCatalog]);

  const referenceChips = useMemo(() => {
    const base = collectAiVideoUnifiedReferenceChips({
      nodeId,
      edges,
      nodes: typedNodes,
      createObjectUrl,
      resolveMediaPreviewUrl,
    });
    const generationValues = cardGenerationParams.visible
      ? cardGenerationParams.values
      : readNodeGenerationParams(data.inputs);
    const referenceMode = resolveEffectiveVideoReferenceMode(
      data,
      modelRules,
      generationValues
    );
    return annotateVideoReferenceChips(base, referenceMode, referenceCounts, {
      firstFrame: t("workflow.aiVideoPanel.frameRoleFirst"),
      lastFrame: t("workflow.aiVideoPanel.frameRoleLast"),
    });
  }, [
    cardGenerationParams,
    createObjectUrl,
    data,
    edges,
    modelRules,
    nodeId,
    referenceCounts,
    resolveMediaPreviewUrl,
    t,
    typedNodes,
  ]);

  useEffect(() => {
    if (disabled || !updateNodeData) {
      return;
    }
    const flowNodes = typedNodes.map((node) => ({ id: node.id, data: node.data }));
    const liveNodeData =
      typedNodes.find((node) => node.id === nodeId)?.data ?? data;
    const counts = countAiVideoReferenceCounts(nodeId, edges, flowNodes);
    const syncParams = {
      nodeData: liveNodeData,
      edges,
      nodes: flowNodes,
      targetNodeId: nodeId,
    };
    const patch = syncVideoReferenceModeIfNeeded(syncParams);
    if (!patch) {
      clearReferenceModeAutoSwitchNoticeIfResolved({
        nodeId,
        nodeData: liveNodeData,
        edges,
        nodes: flowNodes,
      });
      return;
    }
    updateNodeData(nodeId, (current) => ({
      ...current,
      inputs: patch.inputs ?? current.inputs,
      metadata: {
        ...(current.metadata ?? {}),
        ...(patch.metadata ?? {}),
      },
    }));
    if (shouldShowReferenceModeAutoSwitchNotice(nodeId, counts)) {
      toast.info("workflow.aiVideoPanel.referenceModeSwitched");
    }
  }, [data, disabled, edges, nodeId, toast, typedNodes, updateNodeData]);

  const selectableModels = useMemo(
    () => models.filter((entry) => entry.selectable),
    [models]
  );

  const modelsFittingRefs = useMemo(
    () => selectableModels.filter(modelFitsCurrentRefs),
    [modelFitsCurrentRefs, selectableModels]
  );

  const showOverLimitHint =
    selectableModels.length > 0 &&
    modelsFittingRefs.length === 0 &&
    referenceCounts.imageCount +
      referenceCounts.videoCount +
      referenceCounts.audioCount >
    0;

  const allowUpload = modelRules.maxReferenceImages > 0;

  const commitPrompt = useCallback(
    (value: string) => {
      if (disabled || !updateNodeData) return;
      updateNodeInput(nodeId, "prompt", value, data.inputs, updateNodeData);
    },
    [data.inputs, disabled, nodeId, updateNodeData]
  );

  const promptBuffer = useBufferedTextValue(promptValue, commitPrompt);

  useEffect(() => {
    if (!hasPromptReference || disabled || !updateNodeData) return;
    if (referencedPrompt === promptValue) return;
    updateNodeInput(nodeId, "prompt", referencedPrompt, data.inputs, updateNodeData);
  }, [
    data.inputs,
    disabled,
    hasPromptReference,
    nodeId,
    promptValue,
    referencedPrompt,
    updateNodeData,
  ]);

  const displayPrompt = hasPromptReference ? referencedPrompt : promptBuffer.value;
  const promptForGenerate = useMemo(() => {
    if (!hasPromptReference) return displayPrompt;
    return resolveAiVideoReferencedPrompt({
      nodeId,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
    });
  }, [displayPrompt, edges, hasPromptReference, nodeId, typedNodes]);
  const promptMaxLength = modelRules.promptMaxChars;
  const promptOverLimit =
    promptForGenerate.trim().length > promptMaxLength;

  const handleStaged = useCallback(
    (localMedia: readonly LocalMediaReference[]) => {
      if (!updateNodeData || localMedia.length === 0) return;
      updateNodeData(nodeId, (current) => {
        const withPreview = withAiVideoStagingPreview(current, localMedia);
        return {
          ...withPreview,
          metadata: withAiVideoGenerateError(
            withGenerativeProgress(
              withAiVideoGeneratingFlag(current.metadata, true),
              {
                phase: "uploading",
                stagingMediaIds: localMedia.map((entry) => entry.mediaId),
              }
            ),
            null
          ),
        };
      });
    },
    [nodeId, updateNodeData]
  );

  const { syncProgress, clearProgress, resolveJobMedia, activeProgressPhase } =
    useGenerativeCloudJobProgress({
      nodeId,
      orgId,
      workflowId,
      cloudConfigured,
      metadata: data.metadata,
      isGenerating,
      persistPhase,
      autoResume: false,
      updateNodeData,
      setPersistPhase,
      setIsGenerating,
      applyBusyMetadata: (metadata, busy) =>
        withAiVideoGeneratingFlag(metadata, busy),
      onStaged: handleStaged,
    });

  useEffect(() => {
    if (!activeProgressPhase) {
      return;
    }
    setProgressNowMs(Date.now());
    const timerId = window.setInterval(() => {
      setProgressNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [activeProgressPhase]);

  const progressButtonLabel = useMemo(() => {
    const base = t(generativeVideoProgressButtonKey(activeProgressPhase));
    const startedAt = readGenerativeProgressStartedAt(data.metadata);
    if (!activeProgressPhase || !startedAt) {
      return base;
    }
    const { minutes, seconds } = formatGenerativeProgressElapsed(
      startedAt,
      progressNowMs
    );
    const elapsed =
      minutes > 0
        ? t("workflow.aiVideoPanel.progressElapsedMinutes", {
            minutes,
            seconds: String(seconds).padStart(2, "0"),
          })
        : t("workflow.aiVideoPanel.progressElapsedSeconds", { seconds });
    return t("workflow.aiVideoPanel.progressWithElapsed", {
      label: base.replace(/[….]+$/u, "").trimEnd(),
      elapsed,
    });
  }, [activeProgressPhase, data.metadata, progressNowMs, t]);

  const promptReferenceSourceName = useMemo(() => {
    const edge = edges.find(
      (entry) =>
        entry.target === nodeId &&
        entry.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID
    );
    if (!edge) return null;
    const source = typedNodes.find((node) => node.id === edge.source);
    return source?.data.name ?? edge.source;
  }, [edges, nodeId, typedNodes]);

  const promptReferenceEditHint = t("workflow.aiVideoPanel.promptReferenceEditHint", {
    nodeName:
      promptReferenceSourceName ??
      t("workflow.aiVideoPanel.promptReferenceEditHintFallback"),
  });

  const commitGenerationParams = useCallback(
    (next: Record<string, unknown>) => {
      if (!cardGenerationParams.visible || disabled || !updateNodeData) return;

      const sanitized = sanitizeCardGenerationParams(
        cardGenerationParams.fields,
        next
      );
      updateNodeInput(nodeId, "params", sanitized, nodeInputs, updateNodeData);
    },
    [cardGenerationParams, disabled, nodeId, nodeInputs, updateNodeData]
  );

  const connectReferenceEdge = useCallback(
    (connection: Parameters<typeof connectGenerativeReferenceEdge>[1]) => {
      connectGenerativeReferenceEdge(setEdges, connection);
    },
    [setEdges]
  );

  const handleDisconnectEdge = (edgeId: string) => {
    const edge = edges.find((entry) => entry.id === edgeId);
    deleteEdge?.(edgeId);
    if (edge?.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID && updateNodeData) {
      updateNodeInput(nodeId, "prompt", "", data.inputs, updateNodeData);
    }
  };

  const handlePickNode = (sourceNodeId: string, sourceHandle: string) => {
    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;

    if (source.data.nodeType === AI_TEXT_NODE_TYPE) {
      const verdict = evaluateAiVideoPromptReferenceStructural({
        targetNodeId: nodeId,
        targetNodeMetadata: data.metadata,
        sourceNodeId,
        sourceNodeType: source.data.nodeType,
        edges,
      });
      if (!verdict.ok) {
        toast.error("workflow.aiVideoPanel.referenceRejected");
        return;
      }
      connectReferenceEdge({
        source: sourceNodeId,
        sourceHandle,
        target: nodeId,
        targetHandle: AI_VIDEO_PROMPT_HANDLE_ID,
      });
      setPickNodeOpen(false);
      return;
    }

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: nodeId,
      sourceNodeId,
      sourceHandle,
      sourceNodeType: source.data.nodeType,
      targetNodeData: data,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      models: videoModelCatalog,
    });
    if (!verdict.ok) {
      toast.error("workflow.aiVideoPanel.referenceRejected");
      return;
    }

    connectReferenceEdge({
      source: sourceNodeId,
      sourceHandle,
      target: nodeId,
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    });
    setPickNodeOpen(false);
  };

  const handleUploadFiles = async (files: FileList) => {
    if (disabled) return;
    const host = getNode(nodeId);
    if (!host) return;

    let offset = 0;
    let added = 0;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error("workflow.aiVideoPanel.referenceRejected");
        continue;
      }

      const check = canAcceptAiVideoReference({
        rules: modelRules,
        kind: "image",
        currentCounts: {
          imageCount: referenceCounts.imageCount + added,
          videoCount: referenceCounts.videoCount,
          audioCount: referenceCounts.audioCount,
        },
        targetNodeData: data,
      });
      if (!check.ok) {
        toast.error("workflow.aiVideoPanel.referenceRejected");
        continue;
      }

      if (file.size > modelRules.maxImageReferenceBytes) {
        toast.error("workflow.aiVideoPanel.referenceRejected");
        continue;
      }

      const catalog = nodeTypes.find((entry) => entry.type === AI_IMAGE_NODE_TYPE);
      if (!catalog) {
        toast.error("workflow.aiVideoPanel.referenceRejected");
        continue;
      }

      try {
        if (!orgId) {
          toast.error("workflow.aiVideoPanel.referenceRejected");
          continue;
        }

        const value = await uploadGenerativeMedia({
          organizationId: orgId,
          workflowId,
          file,
          cloudConfigured,
          mediaKind: "reference",
        });

        const newId = `${AI_IMAGE_NODE_TYPE}-${Date.now()}-${offset}`;
        const position = {
          x: host.position.x - 280,
          y: host.position.y + offset * 100,
        };

        const catalogInputs = mergeAiImageNodeCatalogInputs(
          catalog.type,
          mergeAiTextNodeCatalogInputs(
            catalog.type,
            catalog.inputs.map((param) => ({
              ...param,
              id: param.name,
              value: param.name === "manual_images" ? [value] : param.value,
            })),
            catalog
          ),
          catalog
        );
        const catalogOutputs = catalog.outputs.map((param) => ({
          ...param,
          id: param.name,
          value:
            param.name === AI_IMAGE_OUTPUT_ID
              ? [value]
              : param.value,
        }));

        setNodes((current) => [
          ...current,
          {
            id: newId,
            type: "workflowNode",
            position,
            data: {
              name: resolveGenerativeNodeDisplayName({
                nodeType: catalog.type,
                baseName: resolveGenerativeNodeDefaultBaseName(
                  catalog.type,
                  catalog.name,
                  t
                ),
                existingNodes: nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[],
                additionalSameTypeCount: offset,
              }),
              nodeType: catalog.type,
              icon: catalog.icon,
              inputs: catalogInputs,
              outputs: catalogOutputs,
              executionState: "idle" as const,
              createObjectUrl,
            },
          },
        ]);

        connectReferenceEdge({
          source: newId,
          sourceHandle: AI_IMAGE_OUTPUT_ID,
          target: nodeId,
          targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
        });
        added += 1;
        offset += 1;
      } catch {
        toast.error("workflow.aiVideoPanel.referenceRejected");
      }
    }
  };

  const handleInjectChip = (chip: AiTextReferenceChip) => {
    if (disabled || hasPromptReference || chip.kind !== "image") return;
    const insertion = `[image:${chip.label}]`;
    const current = promptBuffer.value;
    const needsSpace =
      current.length > 0 && !/\s$/.test(current) && !/^\s/.test(insertion);
    promptBuffer.commit(`${current}${needsSpace ? " " : ""}${insertion}`);
  };

  const handleGenerate = async () => {
    if (disabled || !orgId || !effectiveModel) return;
    if (!modelReady || generateInFlightRef.current) return;

    const prompt = promptForGenerate.trim();

    if (hasPromptReference && !prompt) {
      toast.error("workflow.aiVideoPanel.referencedPromptEmpty");
      return;
    }

    if (
      !canGenerateAiVideo({
        prompt,
        referenceCounts,
        rules: modelRules,
        blocksGenerativeMedia,
      })
    ) {
      toast.error("workflow.aiVideoPanel.promptRequired");
      return;
    }

    if (prompt.length > promptMaxLength) {
      toast.error(
        hasPromptReference
          ? "workflow.aiVideoPanel.referencedPromptTooLong"
          : "workflow.generativeErrors.promptTooLong",
        { max: promptMaxLength }
      );
      return;
    }

    const generationValues = cardGenerationParams.visible
      ? cardGenerationParams.values
      : {};
    const mergedGenerationParams = mergeImageGenerationParams(
      cardGenerationParams.visible
        ? cardGenerationParams.fields
        : normalizeVideoModelParameterRules(effectiveModel.parameterRules)
            .generationFields,
      generationValues
    );
    const generateCount = 1;

    generateInFlightRef.current = true;
    setIsGenerating(true);
    /** False when another caller owns persist/progress for any job in this run. */
    let ownsJobProgress = true;
    syncProgress({ phase: "generating" });
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiVideoGenerateError(
        withGenerativeProgress(
          withAiVideoGeneratingFlag(current.metadata, true),
          { phase: "generating" }
        ),
        null
      ),
    }));

    try {
      const referenceMedia = collectGenerativeReferenceMedia({
        nodeId,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
        edges,
        nodes: typedNodes,
      });

      const resolved = await resolveMediaReferencesForVideoGenerate({
        organizationId: orgId,
        references: referenceMedia,
      });

      const hasResolvedReferences =
        resolved.referenceImageUrls.length > 0 ||
        resolved.referenceImageInline.length > 0 ||
        resolved.referenceVideoUrls.length > 0 ||
        resolved.referenceAudioUrls.length > 0;

      if (!prompt && !hasResolvedReferences) {
        toast.error("workflow.aiVideoPanel.promptRequired");
        return;
      }

      const submitPayload = {
        modelCanonicalId: effectiveModel.canonicalId,
        aiInterfaceId: effectiveModel.interfaceId,
        prompt,
        params: mergedGenerationParams,
        referenceImageUrls:
          resolved.referenceImageUrls.length > 0
            ? resolved.referenceImageUrls
            : undefined,
        referenceImageInline:
          resolved.referenceImageInline.length > 0
            ? resolved.referenceImageInline
            : undefined,
        referenceVideoUrls:
          resolved.referenceVideoUrls.length > 0
            ? resolved.referenceVideoUrls
            : undefined,
        referenceAudioUrls:
          resolved.referenceAudioUrls.length > 0
            ? resolved.referenceAudioUrls
            : undefined,
        nodeId,
        workflowId,
        clientRequestId: crypto.randomUUID(),
      } as const;

      interface CompletedVideo {
        readonly video: MediaReference | null;
        readonly aiInterfaceId: string;
        readonly completedAt: number;
        readonly jobId: string | null;
        readonly owned: boolean;
      }

      const runOneGeneration = async (): Promise<CompletedVideo> => {
        const submitResponse = await submitAiVideo(orgId, submitPayload);
        let video: MediaReference | null = null;
        let jobId: string | null = null;
        let owned = true;
        if (submitResponse.jobId) {
          jobId = submitResponse.jobId;
          const resolvedJob = await resolveJobMedia(submitResponse.jobId);
          owned = resolvedJob.owned;
          video = resolvedJob.media[0] ?? null;
          if (owned && !video) {
            throw new Error("Video generation succeeded without a playable reference");
          }
        } else {
          video = await pollUntilVideoReady(
            orgId,
            submitResponse.taskId,
            submitResponse.aiInterfaceId,
            submitPayload.modelCanonicalId,
            workflowId,
            (phase) => syncProgress({ phase })
          );
        }
        return {
          video,
          aiInterfaceId: submitResponse.aiInterfaceId,
          completedAt: Date.now(),
          jobId,
          owned,
        };
      };

      const results = await Promise.allSettled(
        Array.from({ length: generateCount }, () => runOneGeneration())
      );

      const completed = results
        .filter(
          (result): result is PromiseFulfilledResult<CompletedVideo> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
        .sort((left, right) => right.completedAt - left.completedAt);

      const anyUnowned = completed.some((entry) => !entry.owned);
      ownsJobProgress = !anyUnowned;

      const failCount = results.length - completed.length;

      if (completed.length === 0) {
        const firstError = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        throw firstError?.reason instanceof Error
          ? firstError.reason
          : new Error("Video generation failed");
      }

      if (completed.every((entry) => !entry.owned)) {
        return;
      }

      for (const entry of completed) {
        if (!workflowId || !orgId || !entry.video) continue;
        void ensureGenerativeMediaCached({
          organizationId: orgId,
          workflowId,
          media: entry.video,
          nodeType: "ai-video",
        });
      }

      if (!updateNodeData) return;

      const videosToAppend = completed
        .filter(
          (entry) =>
            entry.owned &&
            entry.video &&
            (!entry.jobId || tryClaimGenerativeJobFinalize(entry.jobId))
        )
        .map((entry) => entry.video!);

      const lastAiInterfaceId = completed[0]?.aiInterfaceId ?? "";
      const canWriteHistory = videosToAppend.length > 0;

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
          videosToAppend,
          {
            prompt,
            params: mergedGenerationParams,
            platformModelId: effectiveModel.canonicalId,
            aiInterfaceId: lastAiInterfaceId || effectiveModel.interfaceId,
            modelDisplayName: effectiveModel.displayName,
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

      if (canWriteHistory) {
        if (failCount > 0) {
          toast.success("workflow.aiVideoPanel.generatedPartial", {
            success: videosToAppend.length,
            fail: failCount,
          });
        } else {
          toast.success("workflow.aiVideoPanel.generated");
        }
      }
      setPersistPhase(null);
      if (ownsJobProgress) {
        clearProgress();
      }
    } catch (error) {
      const activeJobId = readActiveGenerationJobId(error);
      if (activeJobId && orgId && updateNodeData) {
        try {
          const resolvedJob = await resolveJobMedia(activeJobId);
          ownsJobProgress = resolvedJob.owned;
          if (!ownsJobProgress) {
            return;
          }
          const videos = resolvedJob.media;
          setPersistPhase(null);
          clearProgress();
          const video = videos[0];
          if (video) {
            if (workflowId) {
              void ensureGenerativeMediaCached({
                organizationId: orgId,
                workflowId,
                media: video,
                nodeType: "ai-video",
              });
            }
            const canWriteHistory = tryClaimGenerativeJobFinalize(activeJobId);
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
                [video],
                {
                  prompt,
                  params: mergedGenerationParams,
                  platformModelId: effectiveModel.canonicalId,
                  aiInterfaceId: effectiveModel.interfaceId,
                  modelDisplayName: effectiveModel.displayName,
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
            if (canWriteHistory) {
              toast.success("workflow.aiVideoPanel.generated");
            }
            return;
          }
        } catch {
          // fall through
        }
      }

      const raw = error instanceof Error ? error.message : String(error);
      const cardError = prepareGenerativeCardError(raw, t);
      updateNodeData?.(nodeId, (current) => ({
        metadata: withAiVideoGenerateError(
          withAiVideoGeneratingFlag(
            clearGenerativeProgress(current.metadata),
            false
          ),
          cardError
        ),
      }));
      toast.errorRaw(cardError.summary);
    } finally {
      generateInFlightRef.current = false;
      if (ownsJobProgress) {
        updateNodeData?.(nodeId, (current) => ({
          metadata: withAiVideoGeneratingFlag(
            clearGenerativeProgress(current.metadata),
            false
          ),
        }));
      }
      setPersistPhase(null);
      setIsGenerating(false);
    }
  };

  const canGenerate =
    modelReady &&
    !disabled &&
    !isGenerating &&
    generativePromptWithinModelLimit(promptForGenerate, promptMaxLength) &&
    canGenerateAiVideo({
      prompt: promptForGenerate,
      referenceCounts,
      rules: modelRules,
      blocksGenerativeMedia,
    });

  const pickableOutputs = useMemo((): readonly GenerativePickNodeEntry[] => {
    const textEntries = listPickableAiVideoPromptSources({
      targetNodeId: nodeId,
      targetNodeMetadata: data.metadata,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
    }).map((entry) => {
      const source = typedNodes.find((node) => node.id === entry.nodeId);
      return {
        nodeId: entry.nodeId,
        outputId: entry.sourceHandle,
        nodeName: source?.data.name ?? entry.nodeId,
        outputName: "text",
        kind: "text" as const,
      };
    });

    const mediaEntries = listPickableAiVideoReferenceSources({
      targetNodeId: nodeId,
      targetNodeData: data,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      models: videoModelCatalog,
    }).map((entry) => {
      const source = typedNodes.find((node) => node.id === entry.nodeId);
      const output = source?.data.outputs?.find(
        (item) => item.id === entry.sourceHandle
      );
      const nodeType = source?.data.nodeType;
      const kind =
        nodeType === AI_VIDEO_NODE_TYPE
          ? ("video" as const)
          : nodeType === AI_AUDIO_NODE_TYPE
            ? ("audio" as const)
            : ("image" as const);
      return {
        nodeId: entry.nodeId,
        outputId: entry.sourceHandle,
        nodeName: source?.data.name ?? entry.nodeId,
        outputName: output?.name ?? entry.sourceHandle,
        kind,
      };
    });

    return [...textEntries, ...mediaEntries];
  }, [data, edges, videoModelCatalog, nodeId, typedNodes]);

  const canAddReference =
    pickableOutputs.length > 0 ||
    (allowUpload &&
      canAcceptAiVideoReference({
        rules: modelRules,
        kind: "image",
        currentCounts: referenceCounts,
        targetNodeData: data,
      }).ok);

  const showStudioPromptBox = shouldShowStudioPromptBox({
    layout,
    hasPromptReference,
    allowUpload,
    referenceChips,
  });
  const studioDockSize = studioDockSizeForPanel({
    layout,
    hasPromptReference,
    allowUpload,
    referenceChips,
  });

  return (
    <>
      <GenerativeConfigPanelShell
        nodeId={nodeId}
        zoom={zoom}
        layout={layout}
        studioDockSize={studioDockSize}
      >
        <div
          className={cn(
            layout === "studio-dock" && !showStudioPromptBox && "min-h-0 flex-1"
          )}
        >
          <AiTextReferenceBar
            chips={referenceChips}
            disabled={disabled}
            allowUpload={allowUpload && !disabled}
            addReferenceDisabled={!canAddReference}
            canPickCanvasNode={pickableOutputs.length > 0}
            onDisconnect={handleDisconnectEdge}
            onPickCanvasNode={() => {
              setPickNodeOpen(true);
            }}
            onUploadFiles={(files) => {
              void handleUploadFiles(files);
            }}
            onInjectChip={handleInjectChip}
          />
        </div>

        {showStudioPromptBox ? (
        <div
          className={cn(
            "relative mt-2 min-h-0",
            layout === "studio-dock" ? "flex-1" : undefined
          )}
          style={
            layout === "studio-dock"
              ? undefined
              : { minHeight: AI_VIDEO_PANEL_PROMPT_MIN_HEIGHT_PX }
          }
        >
          <Textarea
            value={displayPrompt}
            readOnly={hasPromptReference || disabled}
            onChange={(event) => promptBuffer.onChange(event.target.value)}
            onFocus={promptBuffer.onFocus}
            onBlur={promptBuffer.onBlur}
            onCompositionStart={promptBuffer.onCompositionStart}
            onCompositionEnd={promptBuffer.onCompositionEnd}
            maxLength={promptMaxLength}
            placeholder={
              hasPromptReference
                ? undefined
                : t("workflow.aiVideoPanel.promptPlaceholder")
            }
            className={cn(
              "h-full min-h-0 resize-none border-0 bg-transparent pr-7 text-sm leading-4 shadow-none focus-visible:ring-0",
              hasPromptReference &&
                "read-only:cursor-default read-only:text-foreground"
            )}
          />
          {hasPromptReference ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
              <div
                className={cn(
                  "max-w-[92%] rounded-lg border px-3 py-2 text-center text-xs leading-relaxed shadow-sm backdrop-blur-[2px]",
                  promptOverLimit
                    ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                    : "border-border/40 bg-background/50 text-muted-foreground"
                )}
              >
                {promptOverLimit
                  ? t("workflow.aiVideoPanel.referencedPromptTooLong", {
                      max: promptMaxLength,
                    })
                  : promptReferenceEditHint}
              </div>
            </div>
          ) : null}
          {layout === "attached" ? (
            <AiTextExpandButton
              className="absolute right-1 top-1"
              onClick={openCreativeStudio}
            />
          ) : null}
        </div>
        ) : null}

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-end gap-2">
              <AiTextModelPicker
                orgId={orgId}
                models={models as unknown as readonly OrgTextModelOption[]}
                groups={groups}
                selectedOptionId={selectedOptionId}
                chipModel={effectiveModel as unknown as OrgTextModelOption | undefined}
                disabled={disabled || isLoading}
                isLoading={isLoading}
                loadError={Boolean(modelsError)}
                onOpenChange={handlePickerOpenChange}
                onRetryLoad={() => {
                  void refreshModels();
                }}
                modelFitsCurrentRefs={(model) =>
                  modelFitsCurrentRefs(model as unknown as OrgVideoModelOption)
                }
                onSelect={applyModelSelection}
              />
              {cardGenerationParams.visible ? (
                <AiVideoParamsPopover
                  fields={cardGenerationParams.fields}
                  values={cardGenerationParams.values}
                  disabled={disabled}
                  triggerLabel={t("workflow.aiVideoPanel.params")}
                  title={t("workflow.aiVideoPanel.paramsTitle")}
                  onChange={commitGenerationParams}
                />
              ) : null}
            </div>
            {models.length > 0 && selectableModels.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("workflow.aiVideoPanel.enableModelsHint")}{" "}
                <Link
                  to={getOrgUrl("/ai-interfaces")}
                  className="underline underline-offset-2"
                >
                  {t("workflow.aiVideoPanel.openAiInterfaces")}
                </Link>
              </p>
            ) : null}
            {showOverLimitHint ? (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                {t("workflow.aiVideoPanel.referencesExceedModels")}
              </p>
            ) : null}
          </div>

          <AiGenerateButton
            disabled={!canGenerate}
            isGenerating={isGenerating}
            label={progressButtonLabel}
            onClick={() => {
              void handleGenerate();
            }}
          />
        </div>
      </GenerativeConfigPanelShell>

      <GenerativePickNodeDialog
        open={pickNodeOpen}
        onOpenChange={setPickNodeOpen}
        title={t("workflow.aiVideoPanel.pickCanvasNode")}
        emptyMessage={t("workflow.aiVideoPanel.noPickableNodes")}
        entries={pickableOutputs}
        onPick={handlePickNode}
      />
    </>
  );
}
