import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  normalizeTextModelParameterRules,
  type GenerateAiTextResponse,
  type ObjectReference,
  type OrgTextModelOption,
  type TextModelParameterRules,
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
import { Link } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import {
  generateAiText,
  resolveOrgTextModel,
  useOrgTextModels,
} from "@/services/platform-ai-model-service";
import { useObjectService } from "@/services/object-service";

import {
  AiTextExpandButton,
  AiTextExpandOverlay,
} from "./ai-text-expand-overlay";
import { AiTextModelPicker, rememberAiTextRecentModel } from "./ai-text-model-picker";
import {
  AiTextReferenceBar,
  collectAiTextReferenceChips,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import {
  canAcceptAiTextReference,
  countAiTextReferences,
  evaluateAiTextReferenceStructural,
  listPickableReferenceSources,
  resolveAiTextReferenceRules,
} from "./ai-text-reference-policy";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_PANEL_PROMPT_MIN_HEIGHT_PX,
  classifyReferenceFromNodeType,
  pickDefaultTextModelCanonicalId,
  probeVideoFileDurationSeconds,
  probeVideoUrlDurationSeconds,
  referencesFitModelLimits,
  withAiTextGeneratingFlag,
  withAiTextGeneratedResult,
} from "./ai-text-node-utils";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import { connectGenerativeReferenceEdge } from "./generative-reference-utils";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { updateNodeInput, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface AiTextConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

export function AiTextConfigPanel({ nodeId, data }: AiTextConfigPanelProps) {
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
  const { uploadBinaryData, createObjectUrl, getObjectMetadata } =
    useObjectService();
  const orgId = organization?.id;

  const { models, groups, isLoading } = useOrgTextModels(orgId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [pickNodeOpen, setPickNodeOpen] = useState(false);

  const textModelCatalog = useMemo(
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
      collectAiTextReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
        createObjectUrl,
      }),
    [createObjectUrl, edges, nodeId, typedNodes]
  );

  const currentReferenceCounts = useMemo(
    () =>
      countAiTextReferences(
        nodeId,
        edges,
        typedNodes.map((node) => ({ id: node.id, data: node.data }))
      ),
    [edges, nodeId, typedNodes]
  );

  const selectedModel = useMemo(
    () => models.find((entry) => entry.canonicalId === selectedModelId),
    [models, selectedModelId]
  );

  const modelRules = useMemo(
    () =>
      resolveAiTextReferenceRules({
        targetNodeData: data,
        models: textModelCatalog,
      }),
    [data, textModelCatalog]
  );

  const modelFitsCurrentRefs = useCallback(
    (model: OrgTextModelOption) =>
      referencesFitModelLimits(
        currentReferenceCounts,
        normalizeTextModelParameterRules(model.parameterRules)
      ),
    [currentReferenceCounts]
  );

  const keywordsValue = useMemo(() => {
    const parts: string[] = [];
    for (const edge of edges) {
      if (
        edge.target !== nodeId ||
        edge.targetHandle !== AI_TEXT_KEYWORDS_HANDLE_ID
      ) {
        continue;
      }
      const sourceNode = typedNodes.find((node) => node.id === edge.source);
      if (!sourceNode) continue;
      const sourceData = sourceNode.data;
      if (sourceData.nodeType !== AI_TEXT_NODE_TYPE) continue;
      const output = sourceData.outputs?.find(
        (item) => item.id === edge.sourceHandle
      );
      if (typeof output?.value === "string" && output.value.trim()) {
        parts.push(output.value.trim());
      } else {
        const resultInput = sourceData.inputs?.find(
          (item) => item.id === "result"
        );
        if (typeof resultInput?.value === "string" && resultInput.value.trim()) {
          parts.push(resultInput.value.trim());
        }
      }
    }
    return parts.length > 0 ? parts.join("\n") : undefined;
  }, [edges, nodeId, typedNodes]);

  const hasAiTextReference = useMemo(
    () =>
      edges.some((edge) => {
        if (
          edge.target !== nodeId ||
          edge.targetHandle !== AI_TEXT_KEYWORDS_HANDLE_ID
        ) {
          return false;
        }
        const source = typedNodes.find((node) => node.id === edge.source);
        return source?.data.nodeType === AI_TEXT_NODE_TYPE;
      }),
    [edges, nodeId, typedNodes]
  );

  const promptMaxLength = modelRules.promptMaxChars;
  const allowUpload =
    modelRules.maxImageReferences > 0 || modelRules.maxVideoReferences > 0;

  const selectableModels = useMemo(
    () => models.filter((entry) => entry.selectable),
    [models]
  );

  const modelsFittingRefs = useMemo(
    () => selectableModels.filter((entry) => modelFitsCurrentRefs(entry)),
    [modelFitsCurrentRefs, selectableModels]
  );

  const clearModelSelection = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => {
      const inputs = current.inputs.map((input) => {
        if (input.id === "model" || input.id === "ai_interface_id") {
          return { ...input, value: "" } as WorkflowParameter;
        }
        return input;
      });
      return { inputs };
    });
  }, [nodeId, updateNodeData]);

  const applyModelSelection = async (canonicalId: string) => {
    if (disabled || !updateNodeData || !orgId) return;

    const model = models.find((entry) => entry.canonicalId === canonicalId);
    if (!model?.selectable || !modelFitsCurrentRefs(model)) return;

    const inputsAfterModel = updateNodeInput(
      nodeId,
      "model",
      canonicalId,
      data.inputs,
      updateNodeData
    );

    try {
      const resolved = await resolveOrgTextModel(orgId, canonicalId);
      const rules = normalizeTextModelParameterRules(model.parameterRules);
      updateNodeInput(
        nodeId,
        "ai_interface_id",
        resolved.aiInterfaceId,
        inputsAfterModel,
        updateNodeData
      );
      updateNodeData(nodeId, (current) => ({
        metadata: {
          ...(current.metadata ?? {}),
          refMaxText: String(rules.maxTextReferences),
          refMaxImage: String(rules.maxImageReferences),
          refMaxVideo: String(rules.maxVideoReferences),
        },
      }));
    } catch {
      updateNodeInput(
        nodeId,
        "ai_interface_id",
        "",
        inputsAfterModel,
        updateNodeData
      );
    }
  };

  useEffect(() => {
    if (disabled || isLoading || selectedModelId || modelsFittingRefs.length === 0) {
      return;
    }
    const defaultId = pickDefaultTextModelCanonicalId(modelsFittingRefs);
    if (!defaultId) return;
    void applyModelSelection(defaultId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-pick when empty
  }, [disabled, isLoading, selectedModelId, modelsFittingRefs, orgId, updateNodeData, nodeId]);

  // Clear model when current references exceed its limits.
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

  useEffect(() => {
    if (disabled || !updateNodeData || !selectedModel) return;
    const rules = normalizeTextModelParameterRules(selectedModel.parameterRules);
    updateNodeData(nodeId, (current) => {
      const meta = current.metadata ?? {};
      if (
        meta.refMaxText === String(rules.maxTextReferences) &&
        meta.refMaxImage === String(rules.maxImageReferences) &&
        meta.refMaxVideo === String(rules.maxVideoReferences)
      ) {
        return {};
      }
      return {
        metadata: {
          ...meta,
          refMaxText: String(rules.maxTextReferences),
          refMaxImage: String(rules.maxImageReferences),
          refMaxVideo: String(rules.maxVideoReferences),
        },
      };
    });
  }, [disabled, nodeId, selectedModel, updateNodeData]);

  const commitPrompt = useCallback(
    (value: string) => {
      if (disabled || !updateNodeData) return;
      updateNodeData(nodeId, (current) => ({
        inputs: current.inputs.map((input) =>
          input.id === "prompt"
            ? ({ ...input, value } as WorkflowParameter)
            : input
        ),
      }));
    },
    [disabled, nodeId, updateNodeData]
  );

  const promptBuffer = useBufferedTextValue(promptValue, commitPrompt);

  const connectReferenceEdge = useCallback(
    (connection: Parameters<typeof connectGenerativeReferenceEdge>[1]) => {
      connectGenerativeReferenceEdge(setEdges, connection);
    },
    [setEdges]
  );

  const validateReferenceContent = async (params: {
    readonly kind: "text" | "image" | "video";
    readonly rules: TextModelParameterRules;
    readonly textValue?: string;
    readonly objectRef?: ObjectReference;
    readonly file?: File;
  }): Promise<boolean> => {
    const rules = normalizeTextModelParameterRules(params.rules);

    if (params.kind === "text") {
      const text = params.textValue ?? "";
      if (text.length > rules.maxTextReferenceChars) {
        toast.error("workflow.aiTextPanel.referenceTooLarge");
        return false;
      }
      return true;
    }

    if (params.file) {
      if (
        params.kind === "image" &&
        params.file.size > rules.maxImageReferenceBytes
      ) {
        toast.error("workflow.aiTextPanel.referenceTooLarge");
        return false;
      }
      if (
        params.kind === "video" &&
        params.file.size > rules.maxVideoReferenceBytes
      ) {
        toast.error("workflow.aiTextPanel.referenceTooLarge");
        return false;
      }
      if (params.kind === "video") {
        try {
          const seconds = await probeVideoFileDurationSeconds(params.file);
          if (seconds > rules.maxVideoReferenceSeconds) {
            toast.error("workflow.aiTextPanel.referenceTooLong");
            return false;
          }
        } catch {
          toast.error("workflow.aiTextPanel.referenceProbeFailed");
          return false;
        }
      }
      return true;
    }

    if (params.objectRef && orgId) {
      try {
        const meta = await getObjectMetadata(
          params.objectRef.id,
          params.objectRef.mimeType
        );
        if (
          params.kind === "image" &&
          meta.size > rules.maxImageReferenceBytes
        ) {
          toast.error("workflow.aiTextPanel.referenceTooLarge");
          return false;
        }
        if (
          params.kind === "video" &&
          meta.size > rules.maxVideoReferenceBytes
        ) {
          toast.error("workflow.aiTextPanel.referenceTooLarge");
          return false;
        }
        if (params.kind === "video") {
          const url = createObjectUrl(params.objectRef);
          const seconds = await probeVideoUrlDurationSeconds(url);
          if (seconds > rules.maxVideoReferenceSeconds) {
            toast.error("workflow.aiTextPanel.referenceTooLong");
            return false;
          }
        }
      } catch {
        toast.error("workflow.aiTextPanel.referenceProbeFailed");
        return false;
      }
    }

    return true;
  };

  const handlePickNode = async (sourceNodeId: string, sourceHandle: string) => {
    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;
    const sourceData = source.data;
    const kind = classifyReferenceFromNodeType(sourceData.nodeType);
    if (!kind) {
      toast.error("workflow.aiTextPanel.referenceRejected");
      return;
    }

    const verdict = evaluateAiTextReferenceStructural({
      targetNodeId: nodeId,
      sourceNodeId,
      sourceHandle,
      sourceNodeType: sourceData.nodeType,
      targetNodeData: data,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      models: textModelCatalog,
    });
    if (!verdict.ok) {
      toast.error("workflow.aiTextPanel.referenceRejected");
      return;
    }

    const output = sourceData.outputs?.find((entry) => entry.id === sourceHandle);
    if (kind === "text") {
      const text =
        (typeof output?.value === "string" && output.value) ||
        (typeof sourceData.inputs.find((i) => i.id === "result")?.value ===
          "string"
          ? (sourceData.inputs.find((i) => i.id === "result")?.value as string)
          : "");
      const ok = await validateReferenceContent({
        kind: "text",
        rules: modelRules,
        textValue: text,
      });
      if (!ok) return;
    } else {
      const value = output?.value;
      const ref = Array.isArray(value)
        ? (value[0] as ObjectReference | undefined)
        : (value as ObjectReference | undefined);
      if (ref && typeof ref === "object" && "id" in ref) {
        const ok = await validateReferenceContent({
          kind,
          rules: modelRules,
          objectRef: ref,
        });
        if (!ok) return;
      }
    }

    connectReferenceEdge({
      source: sourceNodeId,
      sourceHandle,
      target: nodeId,
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
    });
    setPickNodeOpen(false);
  };

  const handleUploadFiles = async (files: FileList) => {
    if (disabled) return;
    const host = getNode(nodeId);
    if (!host) return;

    let offset = 0;
    let addedImage = 0;
    let addedVideo = 0;

    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : null;
      if (!kind) {
        toast.error("workflow.aiTextPanel.referenceRejected");
        continue;
      }

      const catalogType =
        kind === "image" ? AI_IMAGE_NODE_TYPE : AI_VIDEO_NODE_TYPE;
      const check = canAcceptAiTextReference({
        rules: modelRules,
        sourceNodeType: catalogType,
        currentCounts: {
          text: currentReferenceCounts.text,
          image: currentReferenceCounts.image + addedImage,
          video: currentReferenceCounts.video + addedVideo,
        },
      });
      if (!check.ok) {
        toast.error("workflow.aiTextPanel.referenceRejected");
        continue;
      }

      const sizeOk = await validateReferenceContent({
        kind,
        rules: modelRules,
        file,
      });
      if (!sizeOk) continue;

      const catalog = nodeTypes.find((entry) => entry.type === catalogType);
      if (!catalog) {
        toast.error("workflow.aiTextPanel.createNodeFailed");
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const mimeType = file.type || "application/octet-stream";
        const value = (await uploadBinaryData(
          arrayBuffer,
          mimeType
        )) as ObjectReference;

        const outputId = kind === "image" ? "images" : "videos";
        const manualField = kind === "image" ? "manual_images" : "manual_videos";
        const newId = `${catalogType}-${Date.now()}-${offset}`;
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
                value:
                  param.name === manualField
                    ? [value]
                    : param.value,
              })),
              outputs: catalog.outputs.map((param) => ({
                ...param,
                id: param.name,
                value: param.name === outputId ? [value] : undefined,
              })),
              executionState: "idle" as const,
              createObjectUrl,
            },
          },
        ]);

        connectReferenceEdge({
          source: newId,
          sourceHandle: outputId,
          target: nodeId,
          targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
        });
        if (kind === "image") addedImage += 1;
        if (kind === "video") addedVideo += 1;
        offset += 1;
      } catch {
        toast.error("workflow.aiTextPanel.uploadFailed");
      }
    }
  };

  const handleGenerate = async () => {
    if (!orgId || !selectedModel || disabled) return;
    if (!selectedModel.selectable || !modelFitsCurrentRefs(selectedModel)) {
      return;
    }

    promptBuffer.flush();
    const prompt = hasAiTextReference ? undefined : promptBuffer.value;
    const keywords = hasAiTextReference ? keywordsValue : undefined;

    if (!hasAiTextReference && !prompt?.trim()) {
      toast.error("workflow.aiTextPanel.promptRequired");
      return;
    }
    if (hasAiTextReference && !keywords?.trim()) {
      toast.error("workflow.aiTextPanel.keywordsEmpty");
      return;
    }

    setIsGenerating(true);
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiTextGeneratingFlag(current.metadata, true),
    }));
    try {
      const response: GenerateAiTextResponse = await generateAiText(orgId, {
        modelCanonicalId: selectedModel.canonicalId,
        prompt,
        keywords,
        nodeId,
      });

      rememberAiTextRecentModel(orgId, selectedModel.canonicalId);

      if (!updateNodeData) return;

      updateNodeData(nodeId, (current) => {
        const withResult = withAiTextGeneratedResult(current, response.text);
        const inputs = (withResult.inputs ?? current.inputs).map((input) =>
          input.id === "ai_interface_id"
            ? ({ ...input, value: response.aiInterfaceId } as WorkflowParameter)
            : input
        );
        return {
          ...withResult,
          inputs,
          metadata: withAiTextGeneratingFlag(current.metadata, false),
        };
      });

      toast.success("workflow.aiTextPanel.generated");
    } catch (error) {
      if (error instanceof Error) {
        toast.errorRaw(error.message);
      } else {
        toast.error("workflow.aiTextPanel.generateFailed");
      }
    } finally {
      updateNodeData?.(nodeId, (current) => ({
        metadata: withAiTextGeneratingFlag(current.metadata, false),
      }));
      setIsGenerating(false);
    }
  };

  const selectedModelOk =
    Boolean(selectedModel?.selectable) &&
    Boolean(selectedModel && modelFitsCurrentRefs(selectedModel));

  const canGenerate =
    selectedModelOk &&
    !disabled &&
    !isGenerating &&
    (hasAiTextReference
      ? Boolean(keywordsValue?.trim())
      : promptBuffer.value.trim().length > 0);

  const pickableOutputs = useMemo((): readonly GenerativePickNodeEntry[] => {
    return listPickableReferenceSources({
      targetNodeId: nodeId,
      targetNodeData: data,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      models: textModelCatalog,
    });
  }, [data, edges, nodeId, textModelCatalog, typedNodes]);

  const showOverLimitHint =
    selectableModels.length > 0 &&
    modelsFittingRefs.length === 0 &&
    (currentReferenceCounts.text > 0 ||
      currentReferenceCounts.image > 0 ||
      currentReferenceCounts.video > 0);

  const handleInjectChip = (chip: AiTextReferenceChip) => {
    if (disabled) return;

    const allowed =
      chip.kind === "text"
        ? modelRules.allowPromptInjectText
        : chip.kind === "image"
          ? modelRules.allowPromptInjectImage
          : modelRules.allowPromptInjectVideo;

    if (!allowed) {
      toast.error("workflow.aiTextPanel.injectNotAllowed");
      return;
    }

    let insertion = "";
    if (chip.kind === "text") {
      insertion = (chip.textExcerpt ?? "").trim();
      if (!insertion) {
        toast.error("workflow.aiTextPanel.injectEmpty");
        return;
      }
    } else if (chip.kind === "image") {
      insertion = `[image:${chip.label}]`;
    } else {
      insertion = `[video:${chip.label}]`;
    }

    const current = promptBuffer.value;
    const needsSpace =
      current.length > 0 && !/\s$/.test(current) && !/^\s/.test(insertion);
    const next = `${current}${needsSpace ? " " : ""}${insertion}`;
    if (next.length > promptMaxLength) {
      toast.error("workflow.aiTextPanel.injectExceedsPrompt");
      return;
    }
    promptBuffer.commit(next);
  };

  return (
    <>
      <GenerativeConfigPanelShell zoom={zoom}>
        <AiTextReferenceBar
          chips={referenceChips}
          disabled={disabled}
          allowUpload={allowUpload && !disabled}
          onDisconnect={(edgeId) => deleteEdge?.(edgeId)}
          onPickCanvasNode={() => setPickNodeOpen(true)}
          onUploadFiles={(files) => {
            void handleUploadFiles(files);
          }}
          onInjectChip={handleInjectChip}
        />

        <div
          className="relative mt-2 min-h-0 flex-1"
          style={{ minHeight: AI_TEXT_PANEL_PROMPT_MIN_HEIGHT_PX }}
        >
          <Textarea
            value={promptBuffer.value}
            onChange={(event) => promptBuffer.onChange(event.target.value)}
            onFocus={promptBuffer.onFocus}
            onBlur={promptBuffer.onBlur}
            onCompositionStart={promptBuffer.onCompositionStart}
            onCompositionEnd={promptBuffer.onCompositionEnd}
            maxLength={promptMaxLength}
            placeholder={
              hasAiTextReference
                ? t("workflow.aiTextPanel.promptOptionalWithRefs")
                : t("workflow.aiTextPanel.promptPlaceholder")
            }
            className="h-full min-h-0 resize-none border-0 bg-transparent pr-7 text-sm leading-4 shadow-none focus-visible:ring-0"
          />
          <AiTextExpandButton
            className="absolute right-1 top-1"
            onClick={() => setExpandOpen(true)}
          />
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <AiTextModelPicker
              orgId={orgId}
              models={models}
              groups={groups}
              selectedModelId={selectedModelId}
              disabled={disabled || isLoading || models.length === 0}
              modelFitsCurrentRefs={modelFitsCurrentRefs}
              onSelect={(canonicalId) => {
                void applyModelSelection(canonicalId);
              }}
            />
            {models.length > 0 && selectableModels.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("workflow.aiTextPanel.enableModelsHint")}{" "}
                <Link
                  to={getOrgUrl("/ai-interfaces")}
                  className="underline underline-offset-2"
                >
                  {t("workflow.aiTextPanel.openAiInterfaces")}
                </Link>
              </p>
            ) : null}
            {showOverLimitHint ? (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                {t("workflow.aiTextPanel.referencesExceedModels")}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-1 rounded-lg text-xs"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="h-3.5 w-3.5" />
            )}
            {isGenerating
              ? t("workflow.aiTextPanel.generating")
              : t("workflow.aiTextPanel.generate")}
          </Button>
        </div>
      </GenerativeConfigPanelShell>

      <AiTextExpandOverlay
        open={expandOpen}
        title={t("workflow.aiTextPanel.promptTitle")}
        value={promptBuffer.value}
        onChange={promptBuffer.commit}
        onClose={() => setExpandOpen(false)}
        maxLength={promptMaxLength}
        placeholder={t("workflow.aiTextPanel.promptPlaceholder")}
      />

      <GenerativePickNodeDialog
        open={pickNodeOpen}
        onOpenChange={setPickNodeOpen}
        title={t("workflow.aiTextPanel.pickCanvasNode")}
        emptyMessage={t("workflow.aiTextPanel.noPickableNodes")}
        entries={pickableOutputs}
        onPick={(sourceNodeId, sourceHandle) => {
          void handlePickNode(sourceNodeId, sourceHandle);
        }}
      />
    </>
  );
}

function getInputString(data: WorkflowNodeType, id: string): string {
  const input = data.inputs.find((entry) => entry.id === id);
  return typeof input?.value === "string" ? input.value : "";
}
