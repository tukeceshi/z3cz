import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  applyVideoRetakeEditOverrides,
  getResourceIdFromValue,
  getSeedanceDefaultParameterRules,
  isSeedance25PlatformModel,
  isVolcanoMediaKitVideoTrimEnabled,
  mergeImageGenerationParams,
  normalizeVideoModelParameterRules,
  readVideoPriceEstimateBaseline480pWithoutVideo,
  readVideoPriceEstimateDisplayFolds,
  readVideoPriceEstimateTier,
  resolveDefaultVideoGenerationResolution,
  type OrgTextModelOption,
  type OrgVideoModelOption,
  type WorkflowMediaValue,
  videoTrimSelectionDurationSec,
} from "@dafthunk/types";
import {
  useNodes,
  useReactFlow,
  useViewport,
  type Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useAppToast } from "@/hooks/use-app-toast";
import { useResolvedReferencedPrompt } from "@/hooks/use-resolved-referenced-prompt";
import { cn } from "@/utils/utils";
import { useOrgVideoPickerModels } from "@/services/platform-ai-model-service";
import { resolveMediaReferencesForVideoGenerate } from "@/services/resolve-references-for-generate";
import { uploadGenerativeMedia } from "@/services/upload-generative-media";
import { useObjectService } from "@/services/object-service";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";

import { AiGenerateButton } from "./ai-generate-button";
import { AiTextModelPicker } from "./ai-text-model-picker";
import {
  AiTextReferenceBar,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import {
  AiVideoParamsPopover,
  buildDefaultVideoGenerationParams,
} from "./ai-video-params-popover";
import { AiVideoPriceEstimateChip } from "./ai-video-price-estimate-chip";
import {
  AI_IMAGE_OUTPUT_ID,
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
  canGenerateAiVideo,
  countAiVideoReferenceCountsForNode,
  isAiVideoGenerating,
  readAiVideoCardPrimaryVideo,
  referencesFitVideoModelLimits,
  withAiVideoGenerateError,
} from "./ai-video-node-utils";
import {
  annotateVideoReferenceChips,
  clearReferenceModeAutoSwitchNoticeIfResolved,
  resolveEffectiveVideoReferenceMode,
  shouldShowReferenceModeAutoSwitchNotice,
  syncVideoReferenceModeIfNeeded,
} from "./ai-video-reference-mode";
import {
  canAcceptAiVideoReference,
  listPickableAiVideoReferenceSources,
  resolveAiVideoReferenceRules,
} from "./ai-video-reference-policy";
import {
  collectAiVideoUnifiedReferenceChips,
  hasAiVideoPromptReference,
  listPickableAiVideoPromptSources,
} from "./ai-video-prompt-reference";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import { generativePromptWithinModelLimit } from "./generative-card-upload-utils";
import { collectGenerativeReferenceMedia } from "./generative-reference-utils";
import {
  resolveGenerativeNodeDefaultBaseName,
  resolveGenerativeNodeDisplayName,
} from "./generative-node-naming";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import { ReferenceThumbUrlsProvider } from "./reference-thumb-urls-provider";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useGenerativeParamsEditor } from "./use-generative-params-editor";
import { useGenerativeReferenceConnection } from "./use-generative-reference-connection";
import { useGenerativeVideoFileUpload } from "./use-generative-video-file-upload";
import { useAiVideoRetakeDraft, withAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import { applySelectedModelRecord } from "./generative-model-binding";
import { runVideoRetakePipeline } from "./run-video-retake-pipeline";
import {
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
} from "./generative-progress-utils";
import {
  isWebCodecsVideoTrimSupported,
  resolveTrimSourceVideoUrl,
} from "./video-trim-utils";
import { VideoPromptMentionEditor } from "./video-prompt-mention-editor";
import {
  appendVideoPromptRefToken,
  buildVideoPromptImageEdgeIndexMap,
  compileRetakePromptForSubmit,
  compiledRetakePromptLength,
  formatRetakeEditTimeRangeLabel,
  hasBrokenVideoPromptRefs,
} from "./video-prompt-compile";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

const AI_VIDEO_RETAKE_PROMPT_MIN_HEIGHT_PX = 120 as const;
const RETAKE_HIDDEN_PARAM_FIELD_NAMES = new Set([
  "ratio",
  "aspect_ratio",
  "duration",
  "reference_mode",
]);
const RETAKE_TRIGGER_SUMMARY_FIELD_NAMES = new Set([
  "resolution",
  "size",
  "generate_audio",
]);

function getInputString(data: WorkflowNodeType, id: string): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}

function isRetakeModelBindingSynced(
  data: WorkflowNodeType,
  model: OrgVideoModelOption
): boolean {
  return (
    getInputString(data, "model") === model.canonicalId &&
    getInputString(data, "ai_interface_id") === model.interfaceId
  );
}

export interface AiVideoRetakeConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

export function AiVideoRetakeConfigPanel({
  nodeId,
  data,
}: AiVideoRetakeConfigPanelProps) {
  const {
    disabled,
    updateNodeData,
    edges = [],
    deleteEdge,
    nodeTypes = [],
  } = useWorkflow();
  const nodes = useNodes();
  const { setNodes, getNode } = useReactFlow();
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
  const { draft, isRetakePanel, patchDraft } = useAiVideoRetakeDraft(
    nodeId,
    data
  );
  const sourceMedia = readAiVideoCardPrimaryVideo(
    data.inputs,
    data.outputs,
    data.metadata
  );
  const { uploadVideoFileToNode } = useGenerativeVideoFileUpload();
  const { interfaceId: mediaKitInterfaceId, config: mediaKitConfig } =
    useOrgVolcanoMediaKitConfig(orgId);

  const [isStarting, setIsStarting] = useState(false);
  const [pickNodeOpen, setPickNodeOpen] = useState(false);

  const progressPhase = readGenerativeProgressPhase(data.metadata);
  const isGenerating =
    isAiVideoGenerating(data.metadata) ||
    isGenerativeProgressBusyPhase(progressPhase);

  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];

  const hasPromptReference = useMemo(
    () => hasAiVideoPromptReference({ nodeId, edges }),
    [edges, nodeId]
  );

  const { text: referencedPrompt, loading: referencedPromptLoading } =
    useResolvedReferencedPrompt({
      nodeId,
      targetHandle: AI_VIDEO_PROMPT_HANDLE_ID,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
    });

  const referenceCounts = useMemo(
    () =>
      countAiVideoReferenceCountsForNode(
        nodeId,
        edges,
        typedNodes.map((node) => ({ id: node.id, data: node.data })),
        data
      ),
    [data, edges, nodeId, typedNodes]
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
    models,
    isLoading: modelsLoading,
    modelsError,
    refreshModels,
  } = useOrgVideoPickerModels(orgId);

  const seedance25Models = useMemo(
    () => models.filter((model) => isSeedance25PlatformModel(model.canonicalId)),
    [models]
  );

  const selectedModel = useMemo(() => {
    if (!draft.selectedModelOptionId) {
      return seedance25Models[0] ?? null;
    }
    return (
      seedance25Models.find(
        (model) => model.optionId === draft.selectedModelOptionId
      ) ??
      seedance25Models[0] ??
      null
    );
  }, [draft.selectedModelOptionId, seedance25Models]);

  const applyRetakeModelBinding = useCallback(
    (model: OrgVideoModelOption) => {
      if (disabled || !updateNodeData) {
        return;
      }
      updateNodeData(nodeId, (current) => {
        const withModel = {
          ...current,
          ...applySelectedModelRecord({
            model,
            current,
            modality: "video",
          }),
        };
        return withAiVideoRetakeDraft(withModel, {
          selectedModelOptionId: model.optionId,
        });
      });
    },
    [disabled, nodeId, updateNodeData]
  );

  useEffect(() => {
    if (
      !isRetakePanel ||
      seedance25Models.length === 0 ||
      disabled ||
      !updateNodeData
    ) {
      return;
    }
    const currentId = draft.selectedModelOptionId;
    const resolved =
      currentId &&
      seedance25Models.find((model) => model.optionId === currentId);
    const model = resolved ?? seedance25Models[0] ?? null;
    if (!model) {
      return;
    }
    if (resolved && isRetakeModelBindingSynced(data, model)) {
      return;
    }
    applyRetakeModelBinding(model);
  }, [
    applyRetakeModelBinding,
    data,
    disabled,
    draft.selectedModelOptionId,
    isRetakePanel,
    seedance25Models,
    updateNodeData,
  ]);

  const videoModelCatalog = useMemo(
    () =>
      seedance25Models.map((entry) => ({
        canonicalId: entry.canonicalId,
        parameterRules: entry.parameterRules,
      })),
    [seedance25Models]
  );

  const modelRules = useMemo(() => {
    if (selectedModel) {
      return normalizeVideoModelParameterRules(selectedModel.parameterRules);
    }
    const fallbackCanonicalId = seedance25Models[0]?.canonicalId;
    const fallbackRules = fallbackCanonicalId
      ? getSeedanceDefaultParameterRules(fallbackCanonicalId)
      : undefined;
    if (fallbackRules) {
      return normalizeVideoModelParameterRules(fallbackRules);
    }
    return resolveAiVideoReferenceRules({
      targetNodeData: data,
      models: videoModelCatalog,
    });
  }, [data, seedance25Models, selectedModel, videoModelCatalog]);

  const defaultGenerationParams = useMemo(() => {
    if (!modelRules) {
      return {};
    }
    const base = buildDefaultVideoGenerationParams(modelRules.generationFields);
    const resolutionField = modelRules.generationFields.find(
      (field) => field.name === "resolution"
    );
    const allowedResolutions = resolutionField?.enumValues ?? [];
    const fallbackResolution =
      typeof base.resolution === "string" && base.resolution.trim().length > 0
        ? base.resolution
        : "720p";
    const hasUserResolution =
      draft.generationParams.resolution !== undefined &&
      draft.generationParams.resolution !== null &&
      String(draft.generationParams.resolution).trim().length > 0;
    if (hasUserResolution) {
      return base;
    }
    const resolution = resolveDefaultVideoGenerationResolution({
      width: draft.sourceVideoWidth,
      height: draft.sourceVideoHeight,
      allowedValues: allowedResolutions,
      fallback: fallbackResolution,
    });
    return {
      ...base,
      resolution,
    };
  }, [
    draft.generationParams.resolution,
    draft.sourceVideoHeight,
    draft.sourceVideoWidth,
    modelRules,
  ]);

  const allGenerationFields = modelRules?.generationFields ?? [];

  const paramPopoverFields = useMemo(
    () =>
      allGenerationFields.filter(
        (field) =>
          !field.hidden && !RETAKE_HIDDEN_PARAM_FIELD_NAMES.has(field.name)
      ),
    [allGenerationFields]
  );

  const paramsVisible =
    Boolean(selectedModel) && paramPopoverFields.length > 0;

  const committedGenerationValues = useMemo(() => {
    if (!paramsVisible) {
      return {};
    }
    return mergeImageGenerationParams(paramPopoverFields, {
      ...defaultGenerationParams,
      ...draft.generationParams,
    });
  }, [
    defaultGenerationParams,
    draft.generationParams,
    paramPopoverFields,
    paramsVisible,
  ]);

  const commitGenerationParams = useCallback(
    (next: Record<string, unknown>) => {
      patchDraft({ generationParams: next });
    },
    [patchDraft]
  );

  const promptMaxLength = modelRules?.promptMaxChars ?? 1000;

  const commitPrompt = useCallback(
    (value: string) => {
      patchDraft({ prompt: value });
    },
    [patchDraft]
  );

  const paramsEditor = useGenerativeParamsEditor({
    visible: paramsVisible,
    disabled: disabled || isStarting || isGenerating,
    fields: paramPopoverFields,
    committedValues: committedGenerationValues,
    nodeId,
    nodeInputs: data.inputs,
    modality: "video",
    onCommit: commitGenerationParams,
  });

  const referenceChips = useMemo(() => {
    const base = collectAiVideoUnifiedReferenceChips({
      nodeId,
      edges,
      nodes: typedNodes,
    });
    const generationValues = paramsEditor.effectiveValues;
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
    data,
    edges,
    modelRules,
    nodeId,
    paramsEditor.effectiveValues,
    referenceCounts,
    t,
    typedNodes,
  ]);

  useEffect(() => {
    if (!paramsEditor.isParamsIdle || disabled || !updateNodeData) {
      return;
    }
    const flowNodes = typedNodes.map((node) => ({ id: node.id, data: node.data }));
    const liveNodeData =
      typedNodes.find((node) => node.id === nodeId)?.data ?? data;
    const counts = countAiVideoReferenceCountsForNode(
      nodeId,
      edges,
      flowNodes,
      liveNodeData
    );
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
  }, [
    data,
    disabled,
    edges,
    nodeId,
    paramsEditor.isParamsIdle,
    toast,
    typedNodes,
    updateNodeData,
  ]);

  const modelsFittingRefs = useMemo(
    () => seedance25Models.filter(modelFitsCurrentRefs),
    [modelFitsCurrentRefs, seedance25Models]
  );

  const showOverLimitHint =
    seedance25Models.length > 0 &&
    modelsFittingRefs.length === 0 &&
    referenceCounts.imageCount +
      referenceCounts.videoCount +
      referenceCounts.audioCount >
      0;

  const allowUpload = modelRules.maxReferenceImages > 0;

  const imageReferenceChips = useMemo(
    () => referenceChips.filter((chip) => chip.kind === "image"),
    [referenceChips]
  );

  const imageEdgeIndexMap = useMemo(
    () => buildVideoPromptImageEdgeIndexMap(imageReferenceChips),
    [imageReferenceChips]
  );

  const promptBuffer = useBufferedTextValue(draft.prompt, commitPrompt);

  useEffect(() => {
    if (
      !hasPromptReference ||
      disabled ||
      referencedPromptLoading
    ) {
      return;
    }
    if (referencedPrompt === draft.prompt) {
      return;
    }
    patchDraft({ prompt: referencedPrompt });
  }, [
    disabled,
    draft.prompt,
    hasPromptReference,
    patchDraft,
    referencedPrompt,
    referencedPromptLoading,
  ]);

  const displayPrompt =
    (hasPromptReference ? referencedPrompt : promptBuffer.value) ?? "";

  const hasPromptInput = displayPrompt.trim().length > 0;

  const retakeEditTimeRangeLabel = useMemo(
    () => formatRetakeEditTimeRangeLabel(draft.draftRange),
    [draft.draftRange]
  );

  const storedPromptCompile = useMemo(() => {
    if (hasPromptReference) {
      return { ok: true as const, prompt: referencedPrompt };
    }
    return compileRetakePromptForSubmit(displayPrompt, imageEdgeIndexMap);
  }, [displayPrompt, hasPromptReference, imageEdgeIndexMap, referencedPrompt]);

  const hasBrokenPromptRefs =
    !hasPromptReference &&
    hasBrokenVideoPromptRefs(displayPrompt, imageEdgeIndexMap);

  const promptForGenerate = storedPromptCompile.ok
    ? storedPromptCompile.prompt.trim()
    : "";

  const promptCompiledLength = hasPromptReference
    ? referencedPrompt.length
    : compiledRetakePromptLength(displayPrompt, imageEdgeIndexMap) ??
      displayPrompt.length;

  const promptOverLimit = promptCompiledLength > promptMaxLength;

  const handleModelSelect = useCallback(
    (optionId: string) => {
      const model = seedance25Models.find((entry) => entry.optionId === optionId);
      if (!model) {
        return;
      }
      applyRetakeModelBinding(model);
    },
    [applyRetakeModelBinding, seedance25Models]
  );

  const retakeReady =
    isRetakePanel &&
    draft.loadPhase === "ready" &&
    draft.videoDurationSec !== null &&
    draft.videoDurationSec > 0;

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

  const isBusy = isStarting || isGenerating;

  const canGenerate = Boolean(
    selectedModel &&
      !disabled &&
      !blocksGenerativeMedia &&
      !modelsLoading &&
      retakeReady &&
      !isBusy &&
      hasPromptInput &&
      !hasBrokenPromptRefs &&
      storedPromptCompile.ok &&
      generativePromptWithinModelLimit(promptForGenerate, promptMaxLength) &&
      canGenerateAiVideo({
        prompt: promptForGenerate,
        referenceCounts,
        rules: modelRules,
        blocksGenerativeMedia,
      })
  );

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

  const { canConnectReference, buildReferenceConnection, appendReferenceConnection } =
    useGenerativeReferenceConnection();

  const handleDisconnectEdge = (edgeId: string) => {
    const edge = edges.find((entry) => entry.id === edgeId);
    deleteEdge?.(edgeId);
    if (edge?.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID) {
      patchDraft({ prompt: "" });
    }
  };

  const canAcceptStudioReference = useCallback(
    (sourceNodeId: string, sourceHandle: string) =>
      canConnectReference(sourceNodeId, sourceHandle, nodeId),
    [canConnectReference, nodeId]
  );

  const handlePickNode = (sourceNodeId: string, sourceHandle: string) => {
    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;

    if (!canAcceptStudioReference(sourceNodeId, sourceHandle)) {
      toast.error("workflow.aiVideoPanel.referenceRejected");
      return;
    }

    const connection = buildReferenceConnection(
      sourceNodeId,
      sourceHandle,
      nodeId
    );
    if (!connection || !appendReferenceConnection(connection)) {
      toast.error("workflow.aiVideoPanel.referenceRejected");
      return;
    }
    setPickNodeOpen(false);
  };

  const handleUploadFiles = async (files: FileList) => {
    if (disabled || isBusy) return;
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
            param.name === AI_IMAGE_OUTPUT_ID ? [value] : param.value,
        }));

        const newNode = {
          id: newId,
          type: "workflowNode" as const,
          position,
          data: {
            name: resolveGenerativeNodeDisplayName({
              nodeType: catalog.type,
              baseName: resolveGenerativeNodeDefaultBaseName(
                catalog.type,
                catalog.name,
                t
              ),
              existingNodes:
                nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[],
              additionalSameTypeCount: offset,
            }),
            nodeType: catalog.type,
            icon: catalog.icon,
            inputs: catalogInputs,
            outputs: catalogOutputs,
            executionState: "idle" as const,
            createObjectUrl,
          },
        };

        setNodes((current) => [...current, newNode]);

        if (
          !appendReferenceConnection(
            {
              source: newId,
              sourceHandle: AI_IMAGE_OUTPUT_ID,
              target: nodeId,
              targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
            },
            { nodes: [...nodes, newNode] }
          )
        ) {
          toast.error("workflow.aiVideoPanel.referenceRejected");
          continue;
        }
        added += 1;
        offset += 1;
      } catch {
        toast.error("workflow.aiVideoPanel.referenceRejected");
      }
    }
  };

  const handleInjectChip = (chip: AiTextReferenceChip) => {
    if (disabled || isBusy || hasPromptReference || chip.kind !== "image") {
      return;
    }
    promptBuffer.commit(appendVideoPromptRefToken(promptBuffer.value, chip.edgeId));
  };

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !isRetakePanel || isStarting || isGenerating) {
      return;
    }
    if (
      draft.videoDurationSec === null ||
      !orgId ||
      !workflowId ||
      !sourceMedia
    ) {
      toast.error("workflow.videoRetake.generateFailed");
      return;
    }

    if (hasBrokenPromptRefs) {
      toast.error("workflow.aiVideoPanel.promptMentionBroken");
      return;
    }

    if (!storedPromptCompile.ok) {
      toast.error("workflow.aiVideoPanel.promptMentionBroken");
      return;
    }

    if (!hasPromptInput) {
      toast.error("workflow.aiVideoPanel.promptRequired");
      return;
    }

    const prompt = promptForGenerate;

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

    if (draft.highQuality) {
      if (!mediaKitTrimAvailable || !mediaKitInterfaceId) {
        toast.error("workflow.videoTrim.notConfiguredHint");
        return;
      }
      const sourceResourceId = getResourceIdFromValue(sourceMedia);
      if (
        !sourceResourceId ||
        (sourceMedia as { readonly kind?: string }).kind !== "cloud"
      ) {
        toast.error("workflow.videoTrim.sourceNotCloud");
        return;
      }
    } else if (!isWebCodecsVideoTrimSupported()) {
      toast.error("workflow.videoTrim.webCodecsUnsupported");
      return;
    }

    if (!hasPromptReference) {
      promptBuffer.flush();
    }
    if (!selectedModel) {
      return;
    }

    const flushedParams = paramsEditor.flushBeforeGenerate();
    const generationParams = applyVideoRetakeEditOverrides(
      mergeImageGenerationParams(paramPopoverFields, {
        ...defaultGenerationParams,
        ...flushedParams,
      })
    );

    updateNodeData(nodeId, (current) => ({
      metadata: withAiVideoGenerateError(current.metadata, null),
    }));

    setIsStarting(true);
    void (async () => {
      try {
        const trimSourceVideoUrl = await resolveTrimSourceVideoUrl({
          media: sourceMedia,
          organizationId: orgId,
          workflowId,
        });
        if (!trimSourceVideoUrl) {
          toast.error("workflow.videoRetake.generateFailed");
          return;
        }

        const referenceMedia = collectGenerativeReferenceMedia({
          nodeId,
          targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
          edges,
          nodes: typedNodes,
        });

        const resolved = await resolveMediaReferencesForVideoGenerate({
          organizationId: orgId,
          workflowId,
          cloudConfigured,
          references: referenceMedia,
        });

        runVideoRetakePipeline({
          organizationId: orgId,
          workflowId,
          targetNodeId: nodeId,
          sourceMedia,
          trimSourceVideoUrl,
          committedRange: {
            startSec: draft.draftRange.startSec,
            endSec: draft.draftRange.endSec,
          },
          videoDurationSec: draft.videoDurationSec,
          highQuality: draft.highQuality,
          mediaKitInterfaceId,
          cloudConfigured,
          prompt,
          modelCanonicalId: selectedModel.canonicalId,
          aiInterfaceId: selectedModel.interfaceId,
          instanceId: selectedModel.instanceId.trim() || undefined,
          modelDisplayName: selectedModel.alias,
          supportsTaskCancel: selectedModel.supportsTaskCancel === true,
          generationParams,
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
          updateNodeData,
          uploadVideoFileToNode,
          t,
          toast,
        });
      } finally {
        setIsStarting(false);
      }
    })();
  }, [
    blocksGenerativeMedia,
    canGenerate,
    cloudConfigured,
    defaultGenerationParams,
    draft,
    edges,
    hasBrokenPromptRefs,
    hasPromptInput,
    hasPromptReference,
    isGenerating,
    isRetakePanel,
    isStarting,
    mediaKitInterfaceId,
    mediaKitTrimAvailable,
    modelRules,
    nodeId,
    orgId,
    paramPopoverFields,
    paramsEditor,
    promptBuffer,
    promptForGenerate,
    promptMaxLength,
    referenceCounts,
    selectedModel,
    sourceMedia,
    storedPromptCompile.ok,
    t,
    toast,
    typedNodes,
    updateNodeData,
    uploadVideoFileToNode,
    workflowId,
  ]);

  const generationValuesForEstimate = useMemo(() => {
    const merged = mergeImageGenerationParams(allGenerationFields, {
      ...defaultGenerationParams,
      ...paramsEditor.effectiveValues,
    });
    if (!isRetakePanel) {
      return merged;
    }
    return {
      ...merged,
      duration: videoTrimSelectionDurationSec(draft.draftRange),
    };
  }, [
    allGenerationFields,
    defaultGenerationParams,
    draft.draftRange,
    isRetakePanel,
    paramsEditor.effectiveValues,
  ]);

  const referenceVideoMedia = useMemo((): readonly WorkflowMediaValue[] => {
    if (!isRetakePanel || !sourceMedia) {
      return [];
    }
    return [sourceMedia as unknown as WorkflowMediaValue];
  }, [isRetakePanel, sourceMedia]);

  const referenceVideoDurationSec = useMemo(() => {
    if (!isRetakePanel) {
      return undefined;
    }
    return videoTrimSelectionDurationSec(draft.draftRange);
  }, [draft.draftRange, isRetakePanel]);

  const baseline480pWithoutVideo = useMemo(
    () =>
      modelRules
        ? readVideoPriceEstimateBaseline480pWithoutVideo(modelRules)
        : null,
    [modelRules]
  );

  const priceEstimateTier = useMemo(() => {
    if (!modelRules) {
      return null;
    }
    const resolution =
      typeof generationValuesForEstimate.resolution === "string" &&
      generationValuesForEstimate.resolution.trim().length > 0
        ? generationValuesForEstimate.resolution
        : "720p";
    return readVideoPriceEstimateTier(modelRules, resolution);
  }, [generationValuesForEstimate, modelRules]);

  const priceEstimateDisplayFolds = useMemo(() => {
    if (!modelRules) {
      return [];
    }
    const resolution =
      typeof generationValuesForEstimate.resolution === "string" &&
      generationValuesForEstimate.resolution.trim().length > 0
        ? generationValuesForEstimate.resolution
        : "720p";
    return readVideoPriceEstimateDisplayFolds({
      promos: modelRules?.priceEstimate?.promos,
      orgDiscountFold: modelRules?.orgPriceDiscountFold,
      applyOfficialDiscount: modelRules?.orgApplyOfficialPriceDiscount,
      resolution,
    });
  }, [generationValuesForEstimate, modelRules]);

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

  if (!isRetakePanel) {
    return null;
  }

  return (
    <>
      <GenerativeConfigPanelShell nodeId={nodeId} zoom={zoom} layout="retake-embedded">
        <ReferenceThumbUrlsProvider chips={referenceChips}>
          {(thumbUrls) => (
            <>
              <div>
                <AiTextReferenceBar
                  chips={referenceChips}
                  thumbUrls={thumbUrls}
                  disabled={disabled || isBusy}
                  allowUpload={allowUpload && !disabled && !isBusy}
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

              <div
                className="relative mt-2 flex min-h-0 flex-col"
                style={{ minHeight: AI_VIDEO_RETAKE_PROMPT_MIN_HEIGHT_PX }}
              >
                {!hasPromptReference ? (
                  <div
                    className="pointer-events-none shrink-0 select-none text-sm leading-6 text-foreground"
                    aria-hidden
                  >
                    编辑{" "}
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {retakeEditTimeRangeLabel}
                    </span>
                  </div>
                ) : null}
                <VideoPromptMentionEditor
                  value={displayPrompt}
                  readOnly={
                    hasPromptReference ||
                    disabled ||
                    isBusy ||
                    referencedPromptLoading
                  }
                  disabled={disabled || isBusy}
                  imageChips={imageReferenceChips}
                  thumbUrls={thumbUrls}
                  onChange={promptBuffer.onChange}
                  onFocus={promptBuffer.onFocus}
                  onBlur={promptBuffer.onBlur}
                  onCompositionStart={promptBuffer.onCompositionStart}
                  onCompositionEnd={promptBuffer.onCompositionEnd}
                  placeholder={
                    hasPromptReference
                      ? ""
                      : t("workflow.videoRetake.promptPlaceholder")
                  }
                  className={cn(
                    hasPromptReference ? "min-h-[120px]" : "min-h-[96px]",
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
                {hasBrokenPromptRefs ? (
                  <p className="pointer-events-none absolute inset-x-0 bottom-0 px-0 pb-0 text-[11px] text-destructive">
                    {t("workflow.aiVideoPanel.promptMentionBroken")}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </ReferenceThumbUrlsProvider>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-end gap-2">
              <AiTextModelPicker
                orgId={orgId}
                models={seedance25Models as unknown as readonly OrgTextModelOption[]}
                selectedOptionId={selectedModel?.optionId ?? ""}
                chipModel={selectedModel as unknown as OrgTextModelOption | undefined}
                disabled={disabled || isBusy}
                isLoading={modelsLoading}
                loadError={Boolean(modelsError)}
                onOpenChange={() => {}}
                onRetryLoad={() => {
                  void refreshModels();
                }}
                modelFitsCurrentRefs={(model) =>
                  modelFitsCurrentRefs(model as unknown as OrgVideoModelOption)
                }
                onSelect={handleModelSelect}
              />
              {paramsVisible ? (
                <AiVideoParamsPopover
                  fields={paramPopoverFields}
                  disabled={disabled || isBusy}
                  triggerLabel={t("workflow.aiVideoPanel.params")}
                  title={t("workflow.aiVideoPanel.paramsTitle")}
                  triggerSummaryFieldNames={RETAKE_TRIGGER_SUMMARY_FIELD_NAMES}
                  onInlineCommit={paramsEditor.commitNow}
                  {...paramsEditor.popover}
                />
              ) : null}
              {priceEstimateTier && selectedModel ? (
                <AiVideoPriceEstimateChip
                  canonicalId={selectedModel.canonicalId}
                  priceWithoutVideo={priceEstimateTier.priceWithoutVideo}
                  priceWithVideo={priceEstimateTier.priceWithVideo}
                  baseline480pWithoutVideo={baseline480pWithoutVideo}
                  generationValues={generationValuesForEstimate}
                  referenceVideoMedia={referenceVideoMedia}
                  referenceVideoDurationSec={referenceVideoDurationSec}
                  displayFolds={priceEstimateDisplayFolds}
                  disabled={disabled || isBusy}
                />
              ) : null}
            </div>
            {seedance25Models.length === 0 && !modelsLoading ? (
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
            {promptOverLimit ? (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                {hasPromptReference
                  ? t("workflow.aiVideoPanel.referencedPromptTooLong", {
                      max: promptMaxLength,
                    })
                  : t("workflow.generativeErrors.promptTooLong", {
                      max: promptMaxLength,
                    })}
              </p>
            ) : null}
          </div>

          <AiGenerateButton
            disabled={!canGenerate}
            isGenerating={isBusy}
            isCancelling={false}
            canCancel={false}
            label={t("workflow.aiVideoPanel.generate")}
            cancelLabel={t("workflow.generativeCancel.action")}
            onClick={handleGenerate}
            onCancel={() => {}}
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
