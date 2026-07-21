import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  normalizeVideoModelParameterRules,
  type EphemeralMediaReference,
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
import LoaderIcon from "lucide-react/icons/loader-circle";
import SparklesIcon from "lucide-react/icons/sparkles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { cn } from "@/utils/utils";
import {
  pollAiVideoTask,
  resolveOrgVideoModel,
  submitAiVideo,
  useOrgVideoModels,
} from "@/services/platform-ai-model-service";
import { useObjectService } from "@/services/object-service";
import { cacheMediaFromUrl } from "@/services/ai-media-cache-service";
import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import { resolveMediaFetchUrl } from "@/services/media-url-resolver";

import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import {
  collectGenerativeReferenceChips,
  connectGenerativeReferenceEdge,
} from "./generative-reference-utils";
import {
  AiTextExpandButton,
  AiTextExpandOverlay,
} from "./ai-text-expand-overlay";
import { AiTextModelPicker } from "./ai-text-model-picker";
import {
  AiTextReferenceBar,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import {
  AiVideoParamsPopover,
  buildDefaultVideoGenerationParams,
  readAiVideoGenerationParams,
} from "./ai-video-params-popover";
import {
  AI_IMAGE_OUTPUT_ID,
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_PANEL_PROMPT_MIN_HEIGHT_PX,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
  countAiVideoReferences,
  pickDefaultVideoModelCanonicalId,
  referencesFitVideoModelLimits,
  withAiVideoGeneratedResult,
  withAiVideoGeneratingFlag,
} from "./ai-video-node-utils";
import { resolveGenerativeNodeDisplayName } from "./generative-node-naming";
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
import { updateNodeInput, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_POLL_MAX_ATTEMPTS = 120;

export interface AiVideoConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
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
  };
}

async function pollUntilVideoReady(
  orgId: string,
  taskId: string,
  aiInterfaceId: string
): Promise<string> {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    const result = await pollAiVideoTask(orgId, taskId, aiInterfaceId);
    if (result.status === "succeeded" && result.videoUrl) {
      return result.videoUrl;
    }
    if (result.status === "failed" || result.status === "expired") {
      throw new Error(result.error ?? "Video generation failed");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, VIDEO_POLL_INTERVAL_MS);
    });
  }
  throw new Error("Video generation timed out");
}

export function AiVideoConfigPanel({ nodeId, data }: AiVideoConfigPanelProps) {
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
  const { uploadBinaryData, createObjectUrl } = useObjectService();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;

  const { models, groups, isLoading } = useOrgVideoModels(orgId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [pickNodeOpen, setPickNodeOpen] = useState(false);
  const [generationParams, setGenerationParams] = useState<
    Record<string, unknown>
  >(() => readAiVideoGenerationParams(data.inputs));

  const videoModelCatalog = useMemo(
    () =>
      models.map((entry) => ({
        canonicalId: entry.canonicalId,
        parameterRules: entry.parameterRules,
      })),
    [models]
  );

  const selectedModelId = getInputString(data, "model");
  const promptValue = getInputString(data, "prompt");
  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];

  const referenceChips = useMemo(
    () =>
      collectAiVideoUnifiedReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
        createObjectUrl,
      }),
    [createObjectUrl, edges, nodeId, typedNodes]
  );

  const imageReferenceChips = useMemo(
    () =>
      collectGenerativeReferenceChips({
        nodeId,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
        edges,
        nodes: typedNodes,
        createObjectUrl,
        classifyKind: (nodeType) =>
          nodeType === AI_IMAGE_NODE_TYPE ? "image" : null,
      }),
    [createObjectUrl, edges, nodeId, typedNodes]
  );

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

  const modelRules = useMemo(
    () =>
      resolveAiVideoReferenceRules({
        targetNodeData: data,
        models: videoModelCatalog,
      }),
    [data, videoModelCatalog]
  );

  const generationFields = useMemo(
    () => normalizeVideoModelParameterRules(modelRules).generationFields,
    [modelRules]
  );

  const referenceCount = useMemo(
    () => countAiVideoReferences(nodeId, edges),
    [edges, nodeId]
  );

  const selectedModel = useMemo(
    () => models.find((entry) => entry.canonicalId === selectedModelId),
    [models, selectedModelId]
  );

  const selectableModels = useMemo(
    () => models.filter((entry) => entry.selectable),
    [models]
  );

  const modelFitsCurrentRefs = useCallback(
    (model: OrgVideoModelOption) =>
      referencesFitVideoModelLimits(
        referenceCount,
        normalizeVideoModelParameterRules(model.parameterRules)
      ),
    [referenceCount]
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

  const clearModelSelection = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      inputs: current.inputs.map((input) =>
        input.id === "model"
          ? ({ ...input, value: "" } as WorkflowParameter)
          : input
      ),
    }));
  }, [nodeId, updateNodeData]);

  const applyModelSelection = useCallback(
    async (canonicalId: string) => {
      if (disabled || !updateNodeData || !orgId) return;
      const model = models.find((entry) => entry.canonicalId === canonicalId);
      if (!model?.selectable || !modelFitsCurrentRefs(model)) return;

      const rules = normalizeVideoModelParameterRules(model.parameterRules);
      const defaultParams = buildDefaultVideoGenerationParams(
        rules.generationFields
      );
      setGenerationParams(defaultParams);

      const inputsAfterModel = updateNodeInput(
        nodeId,
        "model",
        canonicalId,
        data.inputs,
        updateNodeData
      );
      updateNodeInput(
        nodeId,
        "params",
        defaultParams,
        inputsAfterModel,
        updateNodeData
      );

      try {
        const resolved = await resolveOrgVideoModel(orgId, canonicalId);
        updateNodeInput(
          nodeId,
          "ai_interface_id",
          resolved.aiInterfaceId,
          inputsAfterModel,
          updateNodeData
        );
      } catch {
        updateNodeInput(
          nodeId,
          "ai_interface_id",
          "",
          inputsAfterModel,
          updateNodeData
        );
      }
    },
    [data.inputs, disabled, modelFitsCurrentRefs, models, nodeId, orgId, updateNodeData]
  );

  useEffect(() => {
    if (disabled || isLoading || selectedModelId || modelsFittingRefs.length === 0) {
      return;
    }
    const defaultId = pickDefaultVideoModelCanonicalId(modelsFittingRefs);
    if (!defaultId) return;
    void applyModelSelection(defaultId);
  }, [
    applyModelSelection,
    disabled,
    isLoading,
    modelsFittingRefs,
    selectedModelId,
  ]);

  useEffect(() => {
    if (disabled || !selectedModelId || !selectedModel) return;
    if (!selectedModel.selectable || !modelFitsCurrentRefs(selectedModel)) {
      clearModelSelection();
    }
  }, [
    clearModelSelection,
    disabled,
    modelFitsCurrentRefs,
    selectedModel,
    selectedModelId,
  ]);

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
  const promptMaxLength = modelRules.promptMaxChars;

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
      setGenerationParams(next);
      if (disabled || !updateNodeData) return;
      updateNodeInput(nodeId, "params", next, data.inputs, updateNodeData);
    },
    [data.inputs, disabled, nodeId, updateNodeData]
  );

  useEffect(() => {
    const stored = readAiVideoGenerationParams(data.inputs);
    if (Object.keys(stored).length > 0) {
      setGenerationParams(stored);
    }
  }, [data.inputs]);

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
        currentCount: referenceCount + added,
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
        const arrayBuffer = await file.arrayBuffer();
        const mimeType = file.type || "application/octet-stream";
        const value = (await uploadBinaryData(
          arrayBuffer,
          mimeType
        )) as ObjectReference;

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
                baseName: catalog.name,
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
    if (disabled || !orgId || !selectedModel) return;

    if (!selectedModel.selectable || !modelFitsCurrentRefs(selectedModel)) {
      return;
    }

    const prompt = displayPrompt.trim();
    if (!prompt) {
      toast.error("workflow.aiVideoPanel.promptRequired");
      return;
    }

    if (prompt.length > promptMaxLength) {
      toast.error("workflow.aiVideoPanel.promptRequired");
      return;
    }

    setIsGenerating(true);
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiVideoGeneratingFlag(current.metadata, true),
    }));

    try {
      const referenceImageUrls = imageReferenceChips
        .map((chip) => chip.previewUrl)
        .filter((url): url is string => Boolean(url));

      const submitResponse = await submitAiVideo(orgId, {
        modelCanonicalId: selectedModel.canonicalId,
        prompt,
        params: generationParams,
        referenceImageUrls,
        nodeId,
        workflowId,
      });

      const videoUrl = await pollUntilVideoReady(
        orgId,
        submitResponse.taskId,
        submitResponse.aiInterfaceId
      );

      const video = createEphemeralVideoReference(videoUrl);

      if (workflowId && orgId) {
        const fetchUrl = resolveMediaFetchUrl(video, orgId, createObjectUrl);
        if (fetchUrl) {
          void cacheMediaFromUrl({
            organizationId: orgId,
            workflowId,
            workflowName: workflowId,
            media: video,
            nodeType: "ai-video",
            fetchUrl,
          }).then((cachedOk) => {
            if (cachedOk) notifyAiMediaCacheChanged();
          });
        }
      }

      if (!updateNodeData) return;

      updateNodeData(nodeId, (current) => {
        const withResult = withAiVideoGeneratedResult(current, [video], {
          prompt,
          params: generationParams,
        });
        const inputs = (withResult.inputs ?? current.inputs).map((input) =>
          input.id === "ai_interface_id"
            ? ({
                ...input,
                value: submitResponse.aiInterfaceId,
              } as WorkflowParameter)
            : input
        );
        return {
          ...withResult,
          inputs,
          metadata: withAiVideoGeneratingFlag(
            withResult.metadata ?? current.metadata,
            false
          ),
        };
      });

      toast.success("workflow.aiVideoPanel.generated");
    } catch (error) {
      if (error instanceof Error) {
        toast.errorRaw(error.message);
      } else {
        toast.error("workflow.aiVideoPanel.generateFailed");
      }
    } finally {
      updateNodeData?.(nodeId, (current) => ({
        metadata: withAiVideoGeneratingFlag(current.metadata, false),
      }));
      setIsGenerating(false);
    }
  };

  const canGenerate =
    !disabled &&
    !isGenerating &&
    displayPrompt.trim().length > 0 &&
    Boolean(selectedModel?.selectable) &&
    (!selectedModel || modelFitsCurrentRefs(selectedModel));

  const pickableOutputs = useMemo((): readonly GenerativePickNodeEntry[] => {
    const textEntries = listPickableAiVideoPromptSources({
      targetNodeId: nodeId,
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

    const imageEntries = listPickableAiVideoReferenceSources({
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
      return {
        nodeId: entry.nodeId,
        outputId: entry.sourceHandle,
        nodeName: source?.data.name ?? entry.nodeId,
        outputName: output?.name ?? entry.sourceHandle,
        kind: "image" as const,
      };
    });

    return [...textEntries, ...imageEntries];
  }, [data, edges, videoModelCatalog, nodeId, typedNodes]);

  const canAddReference =
    pickableOutputs.length > 0 ||
    (allowUpload &&
      canAcceptAiVideoReference({
        rules: modelRules,
        currentCount: referenceCount,
      }).ok);

  return (
    <>
      <GenerativeConfigPanelShell zoom={zoom}>
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

        <div
          className="relative mt-2 min-h-0 flex-1"
          style={{ minHeight: AI_VIDEO_PANEL_PROMPT_MIN_HEIGHT_PX }}
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
              <div className="max-w-[92%] rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-center text-xs leading-relaxed text-muted-foreground shadow-sm backdrop-blur-[2px]">
                {promptReferenceEditHint}
              </div>
            </div>
          ) : null}
          <AiTextExpandButton
            className="absolute right-1 top-1"
            onClick={() => setExpandOpen(true)}
          />
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2">
            {models.length > 0 ? (
              <AiTextModelPicker
                orgId={orgId}
                models={models as unknown as readonly OrgTextModelOption[]}
                groups={groups}
                selectedModelId={selectedModelId}
                disabled={disabled || isLoading}
                modelFitsCurrentRefs={(model) =>
                  modelFitsCurrentRefs(model as unknown as OrgVideoModelOption)
                }
                onSelect={(canonicalId) => {
                  void applyModelSelection(canonicalId);
                }}
              />
            ) : null}
            {generationFields.length > 0 ? (
              <AiVideoParamsPopover
                fields={generationFields}
                values={generationParams}
                disabled={disabled}
                triggerLabel={t("workflow.aiVideoPanel.params")}
                title={t("workflow.aiVideoPanel.paramsTitle")}
                onChange={commitGenerationParams}
              />
            ) : null}
            <div className="min-w-0">
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
          </div>

          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-1 rounded-lg text-xs"
            disabled={!canGenerate}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {isGenerating ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="h-3.5 w-3.5" />
            )}
            {isGenerating
              ? t("workflow.aiVideoPanel.generating")
              : t("workflow.aiVideoPanel.generate")}
          </Button>
        </div>
      </GenerativeConfigPanelShell>

      <AiTextExpandOverlay
        open={expandOpen}
        title={t("workflow.aiVideoPanel.promptTitle")}
        value={displayPrompt}
        onChange={promptBuffer.commit}
        onClose={() => setExpandOpen(false)}
        readOnly={hasPromptReference || disabled}
        maxLength={promptMaxLength}
        placeholder={
          hasPromptReference
            ? promptReferenceEditHint
            : t("workflow.aiVideoPanel.promptPlaceholder")
        }
      />

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
