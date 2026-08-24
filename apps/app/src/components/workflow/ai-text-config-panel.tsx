import {
  AI_TEXT_NODE_TYPE,
  normalizeTextModelParameterRules,
  validateAiTextPromptAssembly,
  type GenerateAiTextResponse,
  isClientCancelledTextModelError,
  type MediaReference,
  type OrgTextModelOption,
  type TextModelParameterRules,
} from "@dafthunk/types";
import {
  useNodes,
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
import { inferAiTextMimeType } from "@dafthunk/types";
import { stageAiTextContent } from "@/services/ai-text-storage-service";
import { hangAiTextExcerptFromKnownText } from "@/services/ai-text-cache-layer";
import {
  isAiTextReferencePendingFromChips,
  resolveAiTextReferenceInputsFromChips,
} from "./resolve-ai-text-result";
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
  referencesFitModelLimits,
  withAiTextGeneratingFlag,
  withAiTextGeneratingHistoryFailed,
  withAiTextStreamingPreview,
} from "./ai-text-node-utils";
import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import { generateAiTextStream, useOrgTextModels } from "@/services/platform-ai-model-service";
import { sha256HexFromText } from "@/utils/text-content-utils";
import { withAiTextStagedGeneratedResult } from "./ai-text-persist-utils";
import { buildResourceIdReference, readAiTextGeneratingResourceId } from "./ai-text-persist-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { createPatchNodeLayoutMetadata } from "./patch-node-layout-metadata";
import { withAiTextStagingDisplayState } from "./ai-text-staging-display-state";
import { withGenerativeCardGenerateError } from "./generative-card-error-utils";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";
import type { CreativeStudioDetailViewRole } from "./creative-studio-detail-view";
import { useOpenCreativeStudio } from "./creative-studio-context";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import { studioReferenceDropPreviewFromVerdict } from "./generative-reference-utils";
import { useGenerativeReferenceConnection } from "./use-generative-reference-connection";
import { validateGenerativeReferenceContentLimits } from "./validate-generative-reference-content";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface AiTextConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly layout?: GenerativeConfigPanelLayout;
  readonly detailRole?: CreativeStudioDetailViewRole;
}

export function AiTextConfigPanel({
  nodeId,
  data,
  layout = "attached",
  detailRole,
}: AiTextConfigPanelProps) {
  const {
    updateNodeData,
    disabled,
    edges = [],
    deleteEdge,
  } = useWorkflow();
  const nodes = useNodes();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const toast = useAppToast();
  const { getOrgUrl } = useOrgUrl();
  const { createObjectUrl } = useObjectService();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();

  const [isGenerating, setIsGenerating] = useState(false);
  useGenerativeMediaWorkSession(isGenerating);
  const generateInFlightRef = useRef(false);
  const generateAbortRef = useRef<AbortController | null>(null);
  const streamPreviewRafRef = useRef<number | null>(null);
  const streamPreviewPendingRef = useRef<string | null>(null);
  const generatingResourceIdRef = useRef<string | undefined>(undefined);
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
  });

  const patchNodeLayout = useMemo(
    () =>
      updateNodeData
        ? createPatchNodeLayoutMetadata(nodeId, updateNodeData)
        : undefined,
    [nodeId, updateNodeData]
  );

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

  const textReferenceChips = useMemo(
    () => referenceChips.filter((chip) => chip.kind === "text"),
    [referenceChips]
  );

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

  const { canConnectReference, buildReferenceConnection, appendReferenceConnection } =
    useGenerativeReferenceConnection();

  const canAcceptStudioReference = useCallback(
    (sourceNodeId: string, sourceHandle: string) =>
      canConnectReference(sourceNodeId, sourceHandle, nodeId),
    [canConnectReference, nodeId]
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

    const limitVerdict = await validateGenerativeReferenceContentLimits({
      kind,
      rules: modelRules,
      sourceData,
      targetNodeType: AI_TEXT_NODE_TYPE,
      targetHandleId: AI_TEXT_KEYWORDS_HANDLE_ID,
      organizationId: orgId,
      workflowId,
    });
    if (!limitVerdict.ok) {
      if (limitVerdict.reason === "too_long") {
        toast.error("workflow.aiTextPanel.referenceTooLong");
      } else if (limitVerdict.reason === "too_large") {
        toast.error("workflow.aiTextPanel.referenceTooLarge");
      } else if (limitVerdict.reason === "probe_failed") {
        toast.error("workflow.aiTextPanel.referenceProbeFailed");
      } else {
        toast.error("workflow.aiTextPanel.referenceRejected");
      }
      return;
    }

    const connection = buildReferenceConnection(
      sourceNodeId,
      sourceHandle,
      nodeId
    );
    if (!connection || !appendReferenceConnection(connection)) {
      toast.error("workflow.aiTextPanel.referenceRejected");
      return;
    }
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

    const textReferences = await resolveAiTextReferenceInputsFromChips({
      chips: textReferenceChips,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      organizationId: orgId,
      workflowId,
    });

    const assembly = validateAiTextPromptAssembly({
      references: textReferences,
      question,
      parameterRules: modelRules,
      mediaReferenceCount,
    });

    if (!assembly.ok) {
      if (textReferences.length === 0 && referenceChips.length > 0) {
        if (
          isAiTextReferencePendingFromChips({
            chips: textReferenceChips,
            nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
          })
        ) {
          toast.error("workflow.aiTextPanel.keywordsPending");
        } else {
          toast.error("workflow.aiTextPanel.keywordsEmpty");
        }
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
    generatingResourceIdRef.current = undefined;
    setIsGenerating(true);
    updateNodeData?.(nodeId, (current) => {
      const preview = withAiTextStreamingPreview(current, "");
      return {
        ...preview,
        metadata: withGenerativeCardGenerateError(
          withAiTextGeneratingFlag(preview.metadata ?? current.metadata, true),
          null
        ),
      };
    });
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
          workflowId,
        },
        {
          signal: abortController.signal,
          onStarted: ({ workflowNodeContent }) => {
            if (!workflowNodeContent) {
              return;
            }
            updateNodeData?.(nodeId, (current) => {
              const patched = applyWorkflowNodeContentPatch(
                current,
                workflowNodeContent
              );
              generatingResourceIdRef.current =
                readAiTextGeneratingResourceId(patched.inputs ?? current.inputs);
              return {
                ...patched,
                metadata: withAiTextGeneratingFlag(
                  patched.metadata ?? current.metadata,
                  true
                ),
              };
            });
          },
          onDelta: (_delta, fullText) => {
            streamPreviewPendingRef.current = fullText;
            if (streamPreviewRafRef.current !== null) {
              return;
            }
            streamPreviewRafRef.current = window.requestAnimationFrame(() => {
              streamPreviewRafRef.current = null;
              const pending = streamPreviewPendingRef.current;
              if (pending == null) return;
              updateNodeData?.(nodeId, (current) => {
                const preview = withAiTextStreamingPreview(current, pending);
                return {
                  ...preview,
                  metadata: withAiTextGeneratingFlag(
                    preview.metadata ?? current.metadata,
                    true
                  ),
                };
              });
            });
          },
        }
      );

      if (streamPreviewRafRef.current !== null) {
        window.cancelAnimationFrame(streamPreviewRafRef.current);
        streamPreviewRafRef.current = null;
      }
      streamPreviewPendingRef.current = null;

      if (!updateNodeData || !orgId || !workflowId) return;

      const mimeType = inferAiTextMimeType(response.text);
      const contentSha256 =
        response.contentSha256 ?? (await sha256HexFromText(response.text));
      const resourceId =
        response.resourceId ?? generatingResourceIdRef.current;

      const reference = resourceId
        ? buildResourceIdReference({
            resourceId,
            contentSha256,
            mimeType,
          })
        : await stageAiTextContent({
            organizationId: orgId,
            workflowId,
            text: response.text,
            patchNodeLayout,
          });

      if (resourceId) {
        await stageAiTextContent({
          organizationId: orgId,
          workflowId,
          text: response.text,
          mediaId: resourceId,
          patchNodeLayout,
        });
      }

      const staged = {
        reference,
        contentSha256,
        sessionText: response.text,
      };

      const displayState = hangAiTextExcerptFromKnownText({
        organizationId: orgId,
        workflowId,
        reference,
        body: response.text,
      });

      updateNodeData(nodeId, (current) => {
        const withResult = withAiTextStagedGeneratedResult(current, staged, {
          platformModelId: effectiveModel.canonicalId,
          aiInterfaceId: response.aiInterfaceId,
          modelDisplayName: effectiveModel.alias,
        });
        return {
          ...withResult,
          metadata: withAiTextStagingDisplayState(
            withGenerativeCardGenerateError(
              withAiTextGeneratingFlag(withResult.metadata, false),
              null
            ),
            displayState
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
      const cardError = prepareGenerativeCardError(raw, t, "text");
      updateNodeData?.(nodeId, (current) => ({
        ...withAiTextGeneratingHistoryFailed(current),
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
    (promptBuffer.value.trim().length > 0 ||
      mediaReferenceCount > 0 ||
      textReferenceChips.length > 0);

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
          detailRole={detailRole}
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
