import {
  AI_TEXT_NODE_TYPE,
  normalizeTextModelParameterRules,
  validateAiTextPromptAssembly,
  type AiTextReferenceInput,
  type GenerateAiTextResponse,
  isClientCancelledTextModelError,
  type MediaReference,
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
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { generateAiTextStream, useOrgTextModels } from "@/services/platform-ai-model-service";
import { useObjectService } from "@/services/object-service";
import { resolveMediaReferencesForTextGenerate } from "@/services/resolve-references-for-generate";

import { AiGenerateButton } from "./ai-generate-button";
import { StudioDockPromptCharCount } from "./studio-dock-prompt-char-count";
import {
  AiTextExpandButton,
} from "./ai-text-expand-overlay";
import { AiTextModelPicker } from "./ai-text-model-picker";
import { useGenerativeModelCard } from "./use-generative-model-card";
import {
  AiTextReferenceBar,
  collectAiTextReferenceChips,
} from "./ai-text-reference-bar";
import {
  countAiTextReferences,
  evaluateAiTextReferenceStructural,
  listPickableReferenceSources,
  resolveAiTextReferenceRules,
} from "./ai-text-reference-policy";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_PANEL_PROMPT_MIN_HEIGHT_PX,
  classifyReferenceFromNodeType,
  probeVideoUrlDurationSeconds,
  referencesFitModelLimits,
  withAiTextGeneratingFlag,
  withAiTextGeneratedResult,
  withAiTextStreamingPreview,
} from "./ai-text-node-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { withGenerativeCardGenerateError } from "./generative-card-error-utils";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";
import { useOpenCreativeStudio } from "./creative-studio-context";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import { connectGenerativeReferenceEdge, studioReferenceDropPreviewFromVerdict } from "./generative-reference-utils";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface AiTextConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly layout?: GenerativeConfigPanelLayout;
}

export function AiTextConfigPanel({
  nodeId,
  data,
  layout = "attached",
}: AiTextConfigPanelProps) {
  const {
    updateNodeData,
    disabled,
    edges = [],
    deleteEdge,
  } = useWorkflow();
  const nodes = useNodes();
  const { setEdges } = useReactFlow();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const toast = useAppToast();
  const { getOrgUrl } = useOrgUrl();
  const { createObjectUrl, getObjectMetadata } = useObjectService();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();

  const [isGenerating, setIsGenerating] = useState(false);
  useGenerativeMediaWorkSession(isGenerating);
  const generateInFlightRef = useRef(false);
  const generateAbortRef = useRef<AbortController | null>(null);
  const streamPreviewRafRef = useRef<number | null>(null);
  const streamPreviewPendingRef = useRef<string | null>(null);
  const [pickNodeOpen, setPickNodeOpen] = useState(false);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);

  const promptValue = getInputString(data, "prompt");

  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];

  const referenceChips = useMemo(
    () =>
      collectAiTextReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
      }),
    [edges, nodeId, typedNodes]
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

  const modelFitsCurrentRefs = useCallback(
    (model: OrgTextModelOption) =>
      referencesFitModelLimits(
        currentReferenceCounts,
        normalizeTextModelParameterRules(model.parameterRules)
      ),
    [currentReferenceCounts]
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
  } = useGenerativeModelCard({
    orgId,
    modality: "text",
    data,
    nodeId,
    disabled,
    updateNodeData,
    readModelId: (nodeData) => getInputString(nodeData, "model"),
    readInterfaceId: (nodeData) => getInputString(nodeData, "ai_interface_id"),
    useModels: useOrgTextModels,
    modelFitsCurrentRefs,
    onModelSelected: (model) => {
      const rules = normalizeTextModelParameterRules(model.parameterRules);
      return {
        metadata: {
          refMaxText: String(rules.maxTextReferences),
          refMaxImage: String(rules.maxImageReferences),
          refMaxVideo: String(rules.maxVideoReferences),
        },
      };
    },
  });

  const textModelCatalog = useMemo(
    () =>
      models.map((entry) => ({
        canonicalId: entry.canonicalId,
        parameterRules: entry.parameterRules,
      })),
    [models]
  );

  const modelRules = useMemo(() => {
    if (effectiveModel) {
      return normalizeTextModelParameterRules(effectiveModel.parameterRules);
    }
    return resolveAiTextReferenceRules({
      targetNodeData: data,
      models: textModelCatalog,
    });
  }, [data, effectiveModel, textModelCatalog]);

  const textReferences = useMemo((): readonly AiTextReferenceInput[] => {
    return referenceChips
      .filter((chip) => chip.kind === "text" && chip.textExcerpt?.trim())
      .map((chip) => ({
        name: chip.label,
        content: chip.textExcerpt!.trim(),
      }));
  }, [referenceChips]);

  const imageMediaReferences = useMemo((): readonly MediaReference[] => {
    return referenceChips
      .filter((chip) => chip.kind === "image" && chip.media != null)
      .map((chip) => chip.media!);
  }, [referenceChips]);

  const videoMediaReferences = useMemo((): readonly MediaReference[] => {
    return referenceChips
      .filter((chip) => chip.kind === "video" && chip.media != null)
      .map((chip) => chip.media!);
  }, [referenceChips]);

  const mediaReferenceCount =
    imageMediaReferences.length + videoMediaReferences.length;

  const hasNonTextReferences = useMemo(
    () => referenceChips.some((chip) => chip.kind !== "text"),
    [referenceChips]
  );

  const modelSupportsMedia =
    modelRules.maxImageReferences > 0 || modelRules.maxVideoReferences > 0;

  const promptMaxLength = modelRules.promptMaxChars;
  const selectableModels = useMemo(
    () => models.filter((entry) => entry.selectable),
    [models]
  );

  const modelsFittingRefs = useMemo(
    () => selectableModels.filter((entry) => modelFitsCurrentRefs(entry)),
    [modelFitsCurrentRefs, selectableModels]
  );

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

  const canAcceptStudioReference = useCallback(
    (sourceNodeId: string, sourceHandle: string) => {
      const source = typedNodes.find((node) => node.id === sourceNodeId);
      if (!source) return false;
      const kind = classifyReferenceFromNodeType(source.data.nodeType);
      if (!kind) return false;
      return evaluateAiTextReferenceStructural({
        targetNodeId: nodeId,
        sourceNodeId,
        sourceHandle,
        sourceNodeType: source.data.nodeType,
        targetNodeData: data,
        edges,
        nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
        models: textModelCatalog,
      }).ok;
    },
    [data, edges, nodeId, textModelCatalog, typedNodes]
  );

  const previewStudioReferenceDrop = useCallback(
    (sourceNodeId: string, sourceHandle: string) => {
      const source = typedNodes.find((node) => node.id === sourceNodeId);
      if (!source) return "rejected" as const;
      const kind = classifyReferenceFromNodeType(source.data.nodeType);
      if (!kind) return "rejected" as const;
      return studioReferenceDropPreviewFromVerdict(
        evaluateAiTextReferenceStructural({
          targetNodeId: nodeId,
          sourceNodeId,
          sourceHandle,
          sourceNodeType: source.data.nodeType,
          targetNodeData: data,
          edges,
          nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
          models: textModelCatalog,
        })
      );
    },
    [data, edges, nodeId, textModelCatalog, typedNodes]
  );

  const handlePickNode = async (sourceNodeId: string, sourceHandle: string) => {
    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;
    const sourceData = source.data;

    if (!canAcceptStudioReference(sourceNodeId, sourceHandle)) {
      toast.error("workflow.aiTextPanel.referenceRejected");
      return;
    }

    const kind = classifyReferenceFromNodeType(sourceData.nodeType);
    if (!kind) {
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

  const handleGenerate = async () => {
    if (!orgId || !effectiveModel || disabled) return;
    if (!modelReady || generateInFlightRef.current) return;

    promptBuffer.flush();
    const question = promptBuffer.value.trim() || undefined;

    if (hasNonTextReferences && !modelSupportsMedia) {
      toast.error("workflow.aiTextPanel.mediaReferenceUnsupported");
      return;
    }

    const assembly = validateAiTextPromptAssembly({
      references: textReferences,
      question,
      parameterRules: modelRules,
      mediaReferenceCount,
    });

    if (!assembly.ok) {
      if (textReferences.length === 0 && referenceChips.length > 0) {
        toast.error("workflow.aiTextPanel.keywordsEmpty");
      } else if (!question && mediaReferenceCount === 0) {
        toast.error("workflow.aiTextPanel.promptRequired");
      } else {
        toast.errorRaw(assembly.error);
      }
      return;
    }

    generateInFlightRef.current = true;
    const abortController = new AbortController();
    generateAbortRef.current = abortController;
    setIsGenerating(true);
    updateNodeData?.(nodeId, (current) => ({
      ...withAiTextStreamingPreview(current, ""),
      metadata: withGenerativeCardGenerateError(
        withAiTextGeneratingFlag(current.metadata, true),
        null
      ),
    }));
    try {
      let referenceImageUrls: readonly string[] | undefined;
      let referenceImageInline:
        | readonly { readonly mimeType: string; readonly data: string }[]
        | undefined;
      let referenceVideoUrls: readonly string[] | undefined;

      if (mediaReferenceCount > 0) {
        const resolved = await resolveMediaReferencesForTextGenerate({
          organizationId: orgId,
          workflowId,
          cloudConfigured,
          references: [...imageMediaReferences, ...videoMediaReferences],
        });
        referenceImageUrls =
          resolved.referenceImageUrls.length > 0
            ? resolved.referenceImageUrls
            : undefined;
        referenceImageInline =
          resolved.referenceImageInline.length > 0
            ? resolved.referenceImageInline
            : undefined;
        referenceVideoUrls =
          resolved.referenceVideoUrls.length > 0
            ? resolved.referenceVideoUrls
            : undefined;
      }

      const response: GenerateAiTextResponse = await generateAiTextStream(
        orgId,
        {
          modelCanonicalId: effectiveModel.canonicalId,
          aiInterfaceId: effectiveModel.interfaceId,
          prompt: question,
          references:
            textReferences.length > 0 ? textReferences : undefined,
          referenceImageUrls,
          referenceImageInline,
          referenceVideoUrls,
          nodeId,
        },
        {
          signal: abortController.signal,
          onDelta: (_delta, fullText) => {
            streamPreviewPendingRef.current = fullText;
            if (streamPreviewRafRef.current !== null) {
              return;
            }
            streamPreviewRafRef.current = window.requestAnimationFrame(() => {
              streamPreviewRafRef.current = null;
              const pending = streamPreviewPendingRef.current;
              if (pending == null) return;
              updateNodeData?.(nodeId, (current) => ({
                ...withAiTextStreamingPreview(current, pending),
                metadata: withAiTextGeneratingFlag(current.metadata, true),
              }));
            });
          },
        }
      );

      if (streamPreviewRafRef.current !== null) {
        window.cancelAnimationFrame(streamPreviewRafRef.current);
        streamPreviewRafRef.current = null;
      }
      streamPreviewPendingRef.current = null;

      if (!updateNodeData) return;

      updateNodeData(nodeId, (current) => {
        const withResult = withAiTextGeneratedResult(current, response.text, {
          platformModelId: effectiveModel.canonicalId,
          aiInterfaceId: response.aiInterfaceId,
          modelDisplayName: effectiveModel.alias,
        });
        return {
          ...withResult,
          metadata: withGenerativeCardGenerateError(
            withAiTextGeneratingFlag(withResult.metadata, false),
            null
          ),
        };
      });

      toast.success("workflow.aiTextPanel.generated");
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const raw = error instanceof Error ? error.message : String(error);
      if (isClientCancelledTextModelError(raw)) {
        return;
      }
      const cardError = prepareGenerativeCardError(raw, t);
      updateNodeData?.(nodeId, (current) => ({
        metadata: withGenerativeCardGenerateError(
          withAiTextGeneratingFlag(current.metadata, false),
          cardError
        ),
      }));
      toast.errorRaw(cardError.summary);
    } finally {
      if (streamPreviewRafRef.current !== null) {
        window.cancelAnimationFrame(streamPreviewRafRef.current);
        streamPreviewRafRef.current = null;
      }
      streamPreviewPendingRef.current = null;
      if (generateAbortRef.current === abortController) {
        generateAbortRef.current = null;
      }
      generateInFlightRef.current = false;
      updateNodeData?.(nodeId, (current) => ({
        metadata: withAiTextGeneratingFlag(current.metadata, false),
      }));
      setIsGenerating(false);
    }
  };

  const canGenerate =
    modelReady &&
    !disabled &&
    !isGenerating &&
    !(hasNonTextReferences && !modelSupportsMedia) &&
    validateAiTextPromptAssembly({
      references: textReferences,
      question: promptBuffer.value,
      parameterRules: modelRules,
      mediaReferenceCount,
    }).ok;

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

  return (
    <>
      <GenerativeConfigPanelShell
        nodeId={nodeId}
        zoom={zoom}
        layout={layout}
        dropDisabled={disabled}
        previewStudioReferenceDrop={
          layout === "studio-dock" ? previewStudioReferenceDrop : undefined
        }
        onStudioReferenceDrop={
          layout === "studio-dock"
            ? (sourceNodeId, sourceHandle) => {
                void handlePickNode(sourceNodeId, sourceHandle);
              }
            : undefined
        }
      >
        <AiTextReferenceBar
          chips={referenceChips}
          disabled={disabled}
          showStudioReferenceHints={layout === "studio-dock"}
          onDisconnect={(edgeId) => deleteEdge?.(edgeId)}
          onPickCanvasNode={() => setPickNodeOpen(true)}
        />

        <div
          className="relative mt-2 min-h-0 flex-1"
          style={
            layout === "studio-dock"
              ? undefined
              : { minHeight: AI_TEXT_PANEL_PROMPT_MIN_HEIGHT_PX }
          }
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
              referenceChips.some((chip) => chip.kind === "text")
                ? t("workflow.aiTextPanel.promptOptionalWithRefs")
                : t("workflow.aiTextPanel.promptPlaceholder")
            }
            className="h-full min-h-0 resize-none border-0 bg-transparent pr-7 text-sm leading-4 shadow-none focus-visible:ring-0 thin-scrollbar"
          />
          {layout === "attached" ? (
            <AiTextExpandButton
              className="absolute right-1 top-1"
              onClick={openCreativeStudio}
            />
          ) : null}
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <AiTextModelPicker
              orgId={orgId}
              models={models}
              groups={groups}
              selectedOptionId={selectedOptionId}
              chipModel={effectiveModel}
              disabled={disabled || isLoading}
              isLoading={isLoading}
              loadError={Boolean(modelsError)}
              onOpenChange={handlePickerOpenChange}
              onRetryLoad={() => {
                void refreshModels();
              }}
              modelFitsCurrentRefs={modelFitsCurrentRefs}
              onSelect={applyModelSelection}
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
          <div className="flex shrink-0 items-end gap-3">
            {layout === "studio-dock" ? (
              <StudioDockPromptCharCount
                count={promptBuffer.value.length}
                maxLength={promptMaxLength}
              />
            ) : null}
            <AiGenerateButton
              disabled={!canGenerate}
              isGenerating={isGenerating}
              label={
                isGenerating
                  ? t("workflow.aiTextPanel.generating")
                  : t("workflow.aiTextPanel.generate")
              }
              onClick={handleGenerate}
            />
          </div>
        </div>
      </GenerativeConfigPanelShell>

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
