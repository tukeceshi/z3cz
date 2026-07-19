import {
  AI_IMAGE_NODE_TYPE,
  normalizeImageModelParameterRules,
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
import { useOrgImageModels, generateAiImage, resolveOrgImageModel } from "@/services/platform-ai-model-service";
import { useObjectService } from "@/services/object-service";
import {
  cacheMediaFromUrl,
} from "@/services/ai-media-cache-service";
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
  AiImageParamsPopover,
  buildDefaultImageGenerationParams,
  readAiImageGenerationParams,
} from "./ai-image-params-popover";
import {
  AI_IMAGE_PANEL_PROMPT_MIN_HEIGHT_PX,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
  countAiImageReferences,
  pickDefaultImageModelCanonicalId,
  referencesFitImageModelLimits,
  withAiImageGeneratedResult,
  withAiImageGeneratingFlag,
} from "./ai-image-node-utils";
import {
  canAcceptAiImageReference,
  evaluateAiImageReferenceStructural,
  listPickableAiImageReferenceSources,
  resolveAiImageReferenceRules,
} from "./ai-image-reference-policy";
import {
  hasAiImagePromptReference,
  listAiImagePromptReferenceEdges,
  listPickableAiImagePromptSources,
  resolveAiImageReferencedPrompt,
  evaluateAiImagePromptReferenceStructural,
} from "./ai-image-prompt-reference";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { updateNodeInput, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface AiImageConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

function getInputString(data: WorkflowNodeType, id: string): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}

export function AiImageConfigPanel({ nodeId, data }: AiImageConfigPanelProps) {
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

  const { models, groups, isLoading } = useOrgImageModels(orgId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [pickNodeOpen, setPickNodeOpen] = useState(false);
  const [pickMode, setPickMode] = useState<"image" | "prompt">("image");
  const [generationParams, setGenerationParams] = useState<
    Record<string, unknown>
  >(() => readAiImageGenerationParams(data.inputs));

  const imageModelCatalog = useMemo(
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
      collectGenerativeReferenceChips({
        nodeId,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
        edges,
        nodes: typedNodes,
        createObjectUrl,
        classifyKind: (nodeType) =>
          nodeType === AI_IMAGE_NODE_TYPE ? "image" : null,
      }),
    [createObjectUrl, edges, nodeId, typedNodes]
  );

  const promptReferenceEdges = useMemo(
    () =>
      listAiImagePromptReferenceEdges({
        nodeId,
        edges,
        nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      }),
    [edges, nodeId, typedNodes]
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

  const modelRules = useMemo(
    () =>
      resolveAiImageReferenceRules({
        targetNodeData: data,
        models: imageModelCatalog,
      }),
    [data, imageModelCatalog]
  );

  const generationFields = useMemo(
    () => normalizeImageModelParameterRules(modelRules).generationFields,
    [modelRules]
  );

  const referenceCount = useMemo(
    () => countAiImageReferences(nodeId, edges),
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
    (model: OrgImageModelOption) =>
      referencesFitImageModelLimits(
        referenceCount,
        normalizeImageModelParameterRules(model.parameterRules)
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

      const rules = normalizeImageModelParameterRules(model.parameterRules);
      const defaultParams = buildDefaultImageGenerationParams(
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
        const resolved = await resolveOrgImageModel(orgId, canonicalId);
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
    const defaultId = pickDefaultImageModelCanonicalId(modelsFittingRefs);
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

  const commitGenerationParams = useCallback(
    (next: Record<string, unknown>) => {
      setGenerationParams(next);
      if (disabled || !updateNodeData) return;
      updateNodeInput(nodeId, "params", next, data.inputs, updateNodeData);
    },
    [data.inputs, disabled, nodeId, updateNodeData]
  );

  useEffect(() => {
    const stored = readAiImageGenerationParams(data.inputs);
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
    if (edge?.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID && updateNodeData) {
      updateNodeInput(nodeId, "prompt", "", data.inputs, updateNodeData);
    }
  };

  const handlePickNode = (sourceNodeId: string, sourceHandle: string) => {
    if (pickMode === "prompt") {
      const source = typedNodes.find((node) => node.id === sourceNodeId);
      if (!source) return;
      const verdict = evaluateAiImagePromptReferenceStructural({
        targetNodeId: nodeId,
        sourceNodeId,
        sourceNodeType: source.data.nodeType,
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

    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;

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

        setNodes((current) => [
          ...current,
          {
            id: newId,
            type: "workflowNode",
            position,
            data: {
              name: catalog.name,
              nodeType: catalog.type,
              icon: catalog.icon,
              inputs: catalog.inputs.map((param) => ({
                ...param,
                id: param.name,
                value: param.name === "manual_images" ? [value] : param.value,
              })),
              outputs: catalog.outputs.map((param) => ({
                ...param,
                id: param.name,
                value: param.name === "images" ? [value] : undefined,
              })),
              executionState: "idle" as const,
              createObjectUrl,
            },
          },
        ]);

        connectReferenceEdge({
          source: newId,
          sourceHandle: "images",
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
    if (disabled || hasPromptReference) return;
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
      toast.error("workflow.aiImagePanel.promptRequired");
      return;
    }

    if (prompt.length > promptMaxLength) {
      toast.error("workflow.aiImagePanel.promptRequired");
      return;
    }

    setIsGenerating(true);
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiImageGeneratingFlag(current.metadata, true),
    }));

    try {
      const referenceImageUrls = referenceChips
        .map((chip) => chip.previewUrl)
        .filter((url): url is string => Boolean(url));

      const response = await generateAiImage(orgId, {
        modelCanonicalId: selectedModel.canonicalId,
        prompt,
        params: generationParams,
        referenceImageUrls,
        nodeId,
        workflowId,
      });

      if (workflowId && orgId) {
        for (const image of response.images) {
          const fetchUrl = resolveMediaFetchUrl(image, orgId, createObjectUrl);
          if (!fetchUrl) continue;
          void cacheMediaFromUrl({
            organizationId: orgId,
            workflowId,
            workflowName: workflowId,
            media: image,
            nodeType: "ai-image",
            fetchUrl,
          }).then(() => notifyAiMediaCacheChanged());
        }
      }

      if (!updateNodeData) return;

      updateNodeData(nodeId, (current) => {
        const withResult = withAiImageGeneratedResult(current, response.images, {
          prompt,
          params: generationParams,
        });
        const inputs = (withResult.inputs ?? current.inputs).map((input) =>
          input.id === "ai_interface_id"
            ? ({
                ...input,
                value: response.aiInterfaceId,
              } as WorkflowParameter)
            : input
        );
        return {
          ...withResult,
          inputs,
          metadata: withAiImageGeneratingFlag(current.metadata, false),
        };
      });

      toast.success("workflow.aiImagePanel.generated");
    } catch (error) {
      if (error instanceof Error) {
        toast.errorRaw(error.message);
      } else {
        toast.error("workflow.aiImagePanel.generateFailed");
      }
    } finally {
      updateNodeData?.(nodeId, (current) => ({
        metadata: withAiImageGeneratingFlag(current.metadata, false),
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
    if (pickMode === "prompt") {
      return listPickableAiImagePromptSources({
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
    }

    return listPickableAiImageReferenceSources({
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
  }, [data, edges, imageModelCatalog, nodeId, pickMode, typedNodes]);

  return (
    <>
      <GenerativeConfigPanelShell zoom={zoom}>
        <AiTextReferenceBar
          chips={referenceChips}
          disabled={disabled}
          allowUpload={allowUpload && !disabled}
          onDisconnect={handleDisconnectEdge}
          onPickCanvasNode={() => {
            setPickMode("image");
            setPickNodeOpen(true);
          }}
          onUploadFiles={(files) => {
            void handleUploadFiles(files);
          }}
          onInjectChip={handleInjectChip}
        />

        {promptReferenceEdges.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {promptReferenceEdges.map((entry) => (
              <button
                key={entry.edgeId}
                type="button"
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                onClick={() => handleDisconnectEdge(entry.edgeId)}
                title={t("workflow.aiImagePanel.promptReferenceHint")}
              >
                <span className="truncate">{entry.label}</span>
              </button>
            ))}
            {!hasPromptReference ? (
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline underline-offset-2"
                onClick={() => {
                  setPickMode("prompt");
                  setPickNodeOpen(true);
                }}
              >
                {t("workflow.aiImagePanel.linkPrompt")}
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="mt-1 text-[11px] text-muted-foreground underline underline-offset-2"
            onClick={() => {
              setPickMode("prompt");
              setPickNodeOpen(true);
            }}
          >
            {t("workflow.aiImagePanel.linkPrompt")}
          </button>
        )}

        <div
          className="relative mt-2 min-h-0 flex-1"
          style={{ minHeight: AI_IMAGE_PANEL_PROMPT_MIN_HEIGHT_PX }}
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
            placeholder={t("workflow.aiImagePanel.promptPlaceholder")}
            className="h-full min-h-0 resize-none border-0 bg-transparent pr-7 text-sm leading-4 shadow-none focus-visible:ring-0 read-only:cursor-default read-only:bg-muted/20"
          />
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
                  modelFitsCurrentRefs(model as unknown as OrgImageModelOption)
                }
                onSelect={(canonicalId) => {
                  void applyModelSelection(canonicalId);
                }}
              />
            ) : null}
            {generationFields.length > 0 ? (
              <AiImageParamsPopover
                fields={generationFields}
                values={generationParams}
                disabled={disabled}
                triggerLabel={t("workflow.aiImagePanel.params")}
                title={t("workflow.aiImagePanel.paramsTitle")}
                onChange={commitGenerationParams}
              />
            ) : null}
            <div className="min-w-0">
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
              ? t("workflow.aiImagePanel.generating")
              : t("workflow.aiImagePanel.generate")}
          </Button>
        </div>
      </GenerativeConfigPanelShell>

      <AiTextExpandOverlay
        open={expandOpen}
        title={t("workflow.aiImagePanel.promptTitle")}
        value={displayPrompt}
        onChange={promptBuffer.commit}
        onClose={() => setExpandOpen(false)}
        readOnly={hasPromptReference || disabled}
        maxLength={promptMaxLength}
        placeholder={t("workflow.aiImagePanel.promptPlaceholder")}
      />

      <GenerativePickNodeDialog
        open={pickNodeOpen}
        onOpenChange={setPickNodeOpen}
        title={
          pickMode === "prompt"
            ? t("workflow.aiImagePanel.pickPromptNode")
            : t("workflow.aiImagePanel.pickCanvasNode")
        }
        emptyMessage={t("workflow.aiImagePanel.noPickableNodes")}
        entries={pickableOutputs}
        onPick={handlePickNode}
      />
    </>
  );
}
