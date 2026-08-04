import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  normalizeImageModelParameterRules,
  type LocalMediaReference,
  type MediaReference,
  type ObjectReference,
  type OrgImageModelOption,
  type OrgTextModelOption,
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
import { LIST_SCROLL_CLASS } from "@/components/list-scroll";
import { cn } from "@/utils/utils";
import { useOrgImageModels, generateAiImage } from "@/services/platform-ai-model-service";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { useObjectService } from "@/services/object-service";
import { ensureGenerativeMediaCached } from "@/services/stage-generative-media";
import { resolveMediaFetchUrl } from "@/services/media-url-resolver";
import { resolveReferencesForGenerate } from "@/services/resolve-references-for-generate";
import { uploadGenerativeMedia } from "@/services/upload-generative-media";
import { readActiveGenerationJobId } from "@/services/read-active-generation-job-id";
import type { PersistGenerativeMediaPhase } from "@/services/persist-generative-media-from-url";

import {
  clearGenerativeProgress,
  withGenerativeProgress,
} from "./generative-progress-utils";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";
import {
  shouldShowStudioPromptBox,
  studioDockSizeForPanel,
} from "./generative-studio-dock-layout";
import { useOpenCreativeStudio } from "./creative-studio-context";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import {
  collectGenerativeReferenceChips,
  collectImageReferenceMedia,
  connectGenerativeReferenceEdge,
} from "./generative-reference-utils";
import { AiGenerateButton } from "./ai-generate-button";
import {
  AiTextExpandButton,
} from "./ai-text-expand-overlay";
import { AiTextModelPicker } from "./ai-text-model-picker";
import { useGenerativeModelCard } from "./use-generative-model-card";
import {
  persistModelBindingToInputs,
} from "./org-model-selection-utils";
import {
  AiTextReferenceBar,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import {
  AiImageParamsPopover,
  applyAiImageRatioToPrompt,
  buildDefaultImageGenerationParams,
  mergeImageGenerationParams,
} from "./ai-image-params-popover";
import {
  persistNodeGenerationParams,
  sanitizeCardGenerationParams,
} from "./generative-card-params";
import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PANEL_PROMPT_MIN_HEIGHT_PX,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
  countAiImageReferences,
  canGenerateAiImage,
  mergeAiImageNodeCatalogInputs,
  referencesFitImageModelLimits,
  withAiImageGeneratedResult,
  withAiImageStagingPreview,
  withAiImageGeneratingFlag,
  withAiImageGenerateError,
} from "./ai-image-node-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { generativePromptWithinModelLimit } from "./generative-card-upload-utils";
import {
  resolveGenerativeNodeDefaultBaseName,
  resolveGenerativeNodeDisplayName,
} from "./generative-node-naming";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import {
  canAcceptAiImageReference,
  evaluateAiImageReferenceStructural,
  listPickableAiImageReferenceSources,
  resolveAiImageReferenceRules,
} from "./ai-image-reference-policy";
import {
  hasAiImagePromptReference,
  listPickableAiImagePromptSources,
  resolveAiImageReferencedPrompt,
  evaluateAiImagePromptReferenceStructural,
  collectAiImageUnifiedReferenceChips,
} from "./ai-image-prompt-reference";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { updateNodeInput, upsertNodeInputValues, useWorkflow } from "./workflow-context";
import { useGenerativeCloudJobProgress, generativeProgressButtonKey, type ResolveGenerativeJobMediaResult } from "@/hooks/use-generative-cloud-job";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface AiImageConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly layout?: GenerativeConfigPanelLayout;
}

function getInputString(data: WorkflowNodeType, id: string): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}

export function AiImageConfigPanel({
  nodeId,
  data,
  layout = "attached",
}: AiImageConfigPanelProps) {
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
  const [pickNodeOpen, setPickNodeOpen] = useState(false);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);

  const referenceCount = useMemo(
    () => countAiImageReferences(nodeId, edges),
    [edges, nodeId]
  );

  const modelFitsCurrentRefs = useCallback(
    (model: OrgImageModelOption) =>
      referencesFitImageModelLimits(
        referenceCount,
        normalizeImageModelParameterRules(model.parameterRules)
      ),
    [referenceCount]
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
    modality: "image",
    data,
    nodeId,
    disabled,
    updateNodeData,
    readModelId: (nodeData) => getInputString(nodeData, "model"),
    readInterfaceId: (nodeData) => getInputString(nodeData, "ai_interface_id"),
    readGenerationFields: (model) =>
      normalizeImageModelParameterRules(model.parameterRules).generationFields,
    buildDefaultParams: buildDefaultImageGenerationParams,
    useModels: useOrgImageModels,
    modelFitsCurrentRefs,
    onModelSelected: (model, current) => {
      const rules = normalizeImageModelParameterRules(model.parameterRules);
      const defaultParams = buildDefaultImageGenerationParams(
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

  const imageModelCatalog = useMemo(
    () =>
      models.map((entry) => ({
        canonicalId: entry.canonicalId,
        parameterRules: entry.parameterRules,
      })),
    [models]
  );

  const promptValue = getInputString(data, "prompt");
  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];

  const referenceChips = useMemo(
    () =>
      collectAiImageUnifiedReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
        createObjectUrl,
        resolveMediaPreviewUrl,
      }),
    [createObjectUrl, edges, nodeId, resolveMediaPreviewUrl, typedNodes]
  );

  const imageReferenceChips = useMemo(
    () =>
      collectGenerativeReferenceChips({
        nodeId,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
        edges,
        nodes: typedNodes,
        createObjectUrl,
        resolveMediaPreviewUrl,
        classifyKind: (nodeType) =>
          nodeType === AI_IMAGE_NODE_TYPE ? "image" : null,
      }),
    [createObjectUrl, edges, nodeId, resolveMediaPreviewUrl, typedNodes]
  );

  const hasPromptReference = useMemo(
    () => hasAiImagePromptReference({ nodeId, edges }),
    [edges, nodeId]
  );

  const referencedPrompt = useMemo(
    () =>
      resolveAiImageReferencedPrompt({
        nodeId,
        edges,
        nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      }),
    [edges, nodeId, typedNodes]
  );

  const modelRules = useMemo(() => {
    if (effectiveModel) {
      return normalizeImageModelParameterRules(effectiveModel.parameterRules);
    }
    return resolveAiImageReferenceRules({
      targetNodeData: data,
      models: imageModelCatalog,
    });
  }, [data, effectiveModel, imageModelCatalog]);

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
    referenceCount > 0;

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
    return resolveAiImageReferencedPrompt({
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
      if (!updateNodeData) return;
      updateNodeData(nodeId, (current) => {
        const withPreview = withAiImageStagingPreview(current, localMedia);
        return {
          ...withPreview,
          metadata: withAiImageGenerateError(
            withGenerativeProgress(
              withAiImageGeneratingFlag(current.metadata, true),
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
        withAiImageGeneratingFlag(metadata, busy),
      onStaged: handleStaged,
    });

  const promptReferenceSourceName = useMemo(() => {
    const edge = edges.find(
      (entry) =>
        entry.target === nodeId &&
        entry.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID
    );
    if (!edge) return null;
    const source = typedNodes.find((node) => node.id === edge.source);
    return source?.data.name ?? edge.source;
  }, [edges, nodeId, typedNodes]);

  const promptReferenceEditHint = t("workflow.aiImagePanel.promptReferenceEditHint", {
    nodeName:
      promptReferenceSourceName ??
      t("workflow.aiImagePanel.promptReferenceEditHintFallback"),
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
    if (edge?.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID && updateNodeData) {
      updateNodeInput(nodeId, "prompt", "", data.inputs, updateNodeData);
    }
  };

  const handlePickNode = (sourceNodeId: string, sourceHandle: string) => {
    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;

    if (source.data.nodeType === AI_TEXT_NODE_TYPE) {
      const verdict = evaluateAiImagePromptReferenceStructural({
        targetNodeId: nodeId,
        targetNodeMetadata: data.metadata,
        sourceNodeId,
        sourceNodeType: source.data.nodeType,
        edges,
      });
      if (!verdict.ok) {
        toast.error("workflow.aiImagePanel.referenceRejected");
        return;
      }
      connectReferenceEdge({
        source: sourceNodeId,
        sourceHandle,
        target: nodeId,
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      });
      setPickNodeOpen(false);
      return;
    }

    const verdict = evaluateAiImageReferenceStructural({
      targetNodeId: nodeId,
      sourceNodeId,
      sourceHandle,
      sourceNodeType: source.data.nodeType,
      targetNodeData: data,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      models: imageModelCatalog,
    });
    if (!verdict.ok) {
      toast.error("workflow.aiImagePanel.referenceRejected");
      return;
    }

    connectReferenceEdge({
      source: sourceNodeId,
      sourceHandle,
      target: nodeId,
      targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
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
        toast.error("workflow.aiImagePanel.referenceRejected");
        continue;
      }

      const check = canAcceptAiImageReference({
        rules: modelRules,
        currentCount: referenceCount + added,
      });
      if (!check.ok) {
        toast.error("workflow.aiImagePanel.referenceRejected");
        continue;
      }

      if (file.size > modelRules.maxImageReferenceBytes) {
        toast.error("workflow.aiImagePanel.referenceRejected");
        continue;
      }

      const catalog = nodeTypes.find((entry) => entry.type === AI_IMAGE_NODE_TYPE);
      if (!catalog) {
        toast.error("workflow.aiImagePanel.referenceRejected");
        continue;
      }

      try {
        if (!orgId) {
          toast.error("workflow.aiImagePanel.referenceRejected");
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
          targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
        });
        added += 1;
        offset += 1;
      } catch {
        toast.error("workflow.aiImagePanel.referenceRejected");
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
      toast.error("workflow.aiImagePanel.referencedPromptEmpty");
      return;
    }

    if (
      !canGenerateAiImage({
        prompt,
        referenceCount,
        rules: modelRules,
        blocksGenerativeMedia,
      })
    ) {
      toast.error("workflow.aiImagePanel.promptRequired");
      return;
    }

    if (prompt.length > promptMaxLength) {
      toast.error(
        hasPromptReference
          ? "workflow.aiImagePanel.referencedPromptTooLong"
          : "workflow.generativeErrors.promptTooLong",
        { max: promptMaxLength }
      );
      return;
    }

    const generationValues = cardGenerationParams.visible
      ? cardGenerationParams.values
      : {};

    const promptForApi = applyAiImageRatioToPrompt(
      prompt,
      generationValues.ratio
    );

    if (promptForApi.length > promptMaxLength) {
      toast.error(
        hasPromptReference
          ? "workflow.aiImagePanel.referencedPromptTooLong"
          : "workflow.generativeErrors.promptTooLong",
        { max: promptMaxLength }
      );
      return;
    }

    const mergedGenerationParams = mergeImageGenerationParams(
      cardGenerationParams.visible
        ? cardGenerationParams.fields
        : normalizeImageModelParameterRules(effectiveModel.parameterRules)
            .generationFields,
      generationValues
    );

    generateInFlightRef.current = true;
    setIsGenerating(true);
    /** False when another caller owns persist/progress for this job. */
    let ownsJobProgress = true;
    syncProgress({ phase: "generating" });
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiImageGenerateError(
        withGenerativeProgress(
          withAiImageGeneratingFlag(current.metadata, true),
          { phase: "generating" }
        ),
        null
      ),
    }));

    try {
      const referenceMedia = collectImageReferenceMedia({
        nodeId,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
        edges,
        nodes: typedNodes,
        classifyKind: (nodeType) =>
          nodeType === AI_IMAGE_NODE_TYPE ? "image" : null,
      });

      const resolved = await resolveReferencesForGenerate({
        organizationId: orgId,
        references: referenceMedia,
      });

      const hasResolvedReferences =
        resolved.referenceImageUrls.length > 0 ||
        resolved.referenceImageInline.length > 0;

      if (!prompt && !hasResolvedReferences) {
        toast.error("workflow.aiImagePanel.promptRequired");
        return;
      }

      const response = await generateAiImage(orgId, {
        modelCanonicalId: effectiveModel.canonicalId,
        aiInterfaceId: effectiveModel.interfaceId,
        prompt: promptForApi,
        params: mergedGenerationParams,
        referenceImageUrls:
          resolved.referenceImageUrls.length > 0
            ? resolved.referenceImageUrls
            : undefined,
        referenceImageInline:
          resolved.referenceImageInline.length > 0
            ? resolved.referenceImageInline
            : undefined,
        nodeId,
        workflowId,
        clientRequestId: crypto.randomUUID(),
      });

      let finalImages = response.images;
      let finalizeJobId: string | null = null;
      let jobPersistMeta:
        | Pick<ResolveGenerativeJobMediaResult, "requestSnapshot" | "modelCanonicalId">
        | undefined;
      if (response.jobId && response.phase === "ready_to_persist") {
        finalizeJobId = response.jobId;
        const resolvedJob = await resolveJobMedia(response.jobId);
        jobPersistMeta = resolvedJob;
        finalImages = resolvedJob.media;
        ownsJobProgress = resolvedJob.owned;
        if (!ownsJobProgress) {
          return;
        }
      }
      setPersistPhase(null);
      clearProgress();

      if (workflowId && orgId) {
        for (const image of finalImages) {
          void ensureGenerativeMediaCached({
            organizationId: orgId,
            workflowId,
            media: image,
            nodeType: "ai-image",
          });
        }
      }

      if (!updateNodeData) return;

      const canWriteHistory = tryClaimGenerativeJobFinalize(finalizeJobId ?? "");

      updateNodeData(nodeId, (current) => {
        if (!canWriteHistory) {
          return {
            metadata: withAiImageGenerateError(
              withAiImageGeneratingFlag(
                clearGenerativeProgress(current.metadata),
                false
              ),
              null
            ),
          };
        }

        const withResult = withAiImageGeneratedResult(current, finalImages, {
          prompt,
          params: mergedGenerationParams,
          platformModelId: effectiveModel.canonicalId,
          aiInterfaceId: response.aiInterfaceId,
          providerModelId: effectiveModel.providerModelId,
          modelDisplayName: effectiveModel.displayName,
          requestSnapshot:
            response.requestSnapshot ?? jobPersistMeta?.requestSnapshot,
        });
        return {
          ...withResult,
          metadata: withAiImageGenerateError(
            withAiImageGeneratingFlag(
              clearGenerativeProgress(withResult.metadata),
              false
            ),
            null
          ),
        };
      });

      if (canWriteHistory) {
        toast.success("workflow.aiImagePanel.generated");
      }
    } catch (error) {
      const activeJobId = readActiveGenerationJobId(error);
      if (activeJobId && orgId) {
        try {
          const resolvedJob = await resolveJobMedia(activeJobId);
          ownsJobProgress = resolvedJob.owned;
          if (!ownsJobProgress) {
            return;
          }
          const finalImages = resolvedJob.media;
          setPersistPhase(null);
          clearProgress();
          if (workflowId) {
            for (const image of finalImages) {
              void ensureGenerativeMediaCached({
                organizationId: orgId,
                workflowId,
                media: image,
                nodeType: "ai-image",
              });
            }
          }
          const canWriteHistory = tryClaimGenerativeJobFinalize(activeJobId);
          if (updateNodeData) {
            updateNodeData(nodeId, (current) => {
              if (!canWriteHistory) {
                return {
                  metadata: withAiImageGenerateError(
                    withAiImageGeneratingFlag(
                      clearGenerativeProgress(current.metadata),
                      false
                    ),
                    null
                  ),
                };
              }
              const withResult = withAiImageGeneratedResult(current, finalImages, {
                prompt,
                params: mergedGenerationParams,
                platformModelId: effectiveModel.canonicalId,
                aiInterfaceId: effectiveModel.interfaceId,
                providerModelId: effectiveModel.providerModelId,
                modelDisplayName: effectiveModel.displayName,
                requestSnapshot: resolvedJob.requestSnapshot,
              });
              return {
                ...withResult,
                metadata: withAiImageGenerateError(
                  withAiImageGeneratingFlag(
                    clearGenerativeProgress(withResult.metadata),
                    false
                  ),
                  null
                ),
              };
            });
          }
          if (canWriteHistory) {
            toast.success("workflow.aiImagePanel.generated");
          }
          return;
        } catch {
          // fall through to generic error handling
        }
      }

      const raw = error instanceof Error ? error.message : String(error);
      const cardError = prepareGenerativeCardError(raw, t);
      updateNodeData?.(nodeId, (current) => ({
        metadata: withAiImageGenerateError(
          withAiImageGeneratingFlag(current.metadata, false),
          cardError
        ),
      }));
      toast.errorRaw(cardError.summary);
    } finally {
      generateInFlightRef.current = false;
      if (ownsJobProgress) {
        updateNodeData?.(nodeId, (current) => ({
          metadata: withAiImageGeneratingFlag(
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
    canGenerateAiImage({
      prompt: promptForGenerate,
      referenceCount,
      rules: modelRules,
      blocksGenerativeMedia,
    });

  const pickableOutputs = useMemo((): readonly GenerativePickNodeEntry[] => {
    const textEntries = listPickableAiImagePromptSources({
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

    const imageEntries = listPickableAiImageReferenceSources({
      targetNodeId: nodeId,
      targetNodeData: data,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      models: imageModelCatalog,
    }).map((entry) => {
      const source = typedNodes.find((node) => node.id === entry.nodeId);
      const output = source?.data.outputs?.find(
        (item) => item.id === entry.sourceHandle
      );
      return {
        nodeId: entry.nodeId,
        outputId: entry.sourceHandle,
        nodeName: source?.data.name ?? entry.nodeId,
        outputName: output?.name ?? entry.sourceHandle,
        kind: "image" as const,
      };
    });

    return [...textEntries, ...imageEntries];
  }, [data, edges, imageModelCatalog, nodeId, typedNodes]);

  const canAddReference =
    pickableOutputs.length > 0 ||
    (allowUpload &&
      canAcceptAiImageReference({
        rules: modelRules,
        currentCount: referenceCount,
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
              : { minHeight: AI_IMAGE_PANEL_PROMPT_MIN_HEIGHT_PX }
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
                : t("workflow.aiImagePanel.promptPlaceholder")
            }
            className={cn(
              "h-full min-h-0 resize-none border-0 bg-transparent pr-7 text-sm leading-4 shadow-none focus-visible:ring-0",
              LIST_SCROLL_CLASS,
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
                  ? t("workflow.aiImagePanel.referencedPromptTooLong", {
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
                  modelFitsCurrentRefs(model as unknown as OrgImageModelOption)
                }
                onSelect={applyModelSelection}
              />
              {cardGenerationParams.visible ? (
                <AiImageParamsPopover
                  fields={cardGenerationParams.fields}
                  values={cardGenerationParams.values}
                  disabled={disabled}
                  triggerLabel={t("workflow.aiImagePanel.params")}
                  title={t("workflow.aiImagePanel.paramsTitle")}
                  onChange={commitGenerationParams}
                />
              ) : null}
            </div>
            {models.length > 0 && selectableModels.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("workflow.aiImagePanel.enableModelsHint")}{" "}
                <Link
                  to={getOrgUrl("/ai-interfaces")}
                  className="underline underline-offset-2"
                >
                  {t("workflow.aiImagePanel.openAiInterfaces")}
                </Link>
              </p>
            ) : null}
            {showOverLimitHint ? (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                {t("workflow.aiImagePanel.referencesExceedModels")}
              </p>
            ) : null}
          </div>
          <AiGenerateButton
            disabled={!canGenerate}
            isGenerating={isGenerating}
            label={t(generativeProgressButtonKey(activeProgressPhase))}
            onClick={() => {
              void handleGenerate();
            }}
          />
        </div>
      </GenerativeConfigPanelShell>

      <GenerativePickNodeDialog
        open={pickNodeOpen}
        onOpenChange={setPickNodeOpen}
        title={t("workflow.aiImagePanel.pickCanvasNode")}
        emptyMessage={t("workflow.aiImagePanel.noPickableNodes")}
        entries={pickableOutputs}
        onPick={handlePickNode}
      />
    </>
  );
}
