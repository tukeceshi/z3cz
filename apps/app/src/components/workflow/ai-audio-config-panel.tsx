import {
  AI_TEXT_NODE_TYPE,
  normalizeAudioModelParameterRules,
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
import { cn } from "@/utils/utils";
import {
  generateAiAudio,
  useOrgAudioModels,
} from "@/services/platform-ai-model-service";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { ensureGenerativeMediaCached } from "@/services/stage-generative-media";
import { readActiveGenerationJobId } from "@/services/read-active-generation-job-id";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";
import {
  type PersistGenerativeMediaPhase,
} from "@/services/persist-generative-media-from-url";

import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";
import { useOpenCreativeStudio } from "./creative-studio-context";
import {
  clearGenerativeProgress,
  withGenerativeProgress,
} from "./generative-progress-utils";
import {
  GenerativePickNodeDialog,
  type GenerativePickNodeEntry,
} from "./generative-pick-node-dialog";
import { connectGenerativeReferenceEdge } from "./generative-reference-utils";
import { AiGenerateButton } from "./ai-generate-button";
import {
  AiTextExpandButton,
} from "./ai-text-expand-overlay";
import { AiTextModelPicker } from "./ai-text-model-picker";
import { useGenerativeModelCard } from "./use-generative-model-card";
import { persistModelBindingToInputs } from "./org-model-selection-utils";
import { AiTextReferenceBar } from "./ai-text-reference-bar";
import {
  AiAudioParamsPopover,
  buildDefaultAudioGenerationParams,
} from "./ai-audio-params-popover";
import {
  sanitizeCardGenerationParams,
} from "./generative-card-params";
import {
  AI_AUDIO_PANEL_PROMPT_MIN_HEIGHT_PX,
  AI_AUDIO_PROMPT_HANDLE_ID,
  appendAiAudioGeneratedHistoryItems,
  withAiAudioStagingPreview,
  canGenerateAiAudio,
  resolveAiAudioModelRules,
  withAiAudioGeneratingFlag,
  withAiAudioGenerateError,
} from "./ai-audio-node-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { generativePromptWithinModelLimit } from "./generative-card-upload-utils";
import {
  hasAiAudioPromptReference,
  listPickableAiAudioPromptSources,
  resolveAiAudioReferencedPrompt,
  evaluateAiAudioPromptReferenceStructural,
  collectAiAudioPromptReferenceChips,
} from "./ai-audio-prompt-reference";
import { useBufferedTextValue } from "./use-buffered-text-value";
import {
  useGenerativeCloudJobProgress,
  generativeAudioProgressButtonKey,
} from "@/hooks/use-generative-cloud-job";
import { updateNodeInput, upsertNodeInputValues, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export interface AiAudioConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly layout?: GenerativeConfigPanelLayout;
}

function getInputString(data: WorkflowNodeType, id: string): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}

export function AiAudioConfigPanel({
  nodeId,
  data,
  layout = "attached",
}: AiAudioConfigPanelProps) {
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
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();

  const [isGenerating, setIsGenerating] = useState(false);
  const generateInFlightRef = useRef(false);
  const [persistPhase, setPersistPhase] = useState<PersistGenerativeMediaPhase | null>(
    null
  );
  const [pickNodeOpen, setPickNodeOpen] = useState(false);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);

  const promptValue = getInputString(data, "prompt");
  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];

  const referenceChips = useMemo(
    () =>
      collectAiAudioPromptReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
      }),
    [edges, nodeId, typedNodes]
  );

  const hasPromptReference = useMemo(
    () => hasAiAudioPromptReference({ nodeId, edges }),
    [edges, nodeId]
  );

  const referencedPrompt = useMemo(
    () =>
      resolveAiAudioReferencedPrompt({
        nodeId,
        edges,
        nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
      }),
    [edges, nodeId, typedNodes]
  );

  const modelFitsCurrentRefs = useCallback(
    (_model: OrgTextModelOption) => true,
    []
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
    modality: "audio",
    data,
    nodeId,
    disabled,
    updateNodeData,
    readModelId: (nodeData) => getInputString(nodeData, "model"),
    readInterfaceId: (nodeData) => getInputString(nodeData, "ai_interface_id"),
    readGenerationFields: (model) =>
      normalizeAudioModelParameterRules(model.parameterRules).generationFields,
    buildDefaultParams: buildDefaultAudioGenerationParams,
    useModels: useOrgAudioModels,
    modelFitsCurrentRefs,
    onModelSelected: (model, current) => {
      const rules = normalizeAudioModelParameterRules(model.parameterRules);
      const defaultParams = buildDefaultAudioGenerationParams(
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

  const audioModelCatalog = useMemo(
    () =>
      models.map((entry) => ({
        canonicalId: entry.canonicalId,
        parameterRules: entry.parameterRules,
      })),
    [models]
  );

  const modelRules = useMemo(() => {
    if (effectiveModel) {
      return normalizeAudioModelParameterRules(effectiveModel.parameterRules);
    }
    return resolveAiAudioModelRules(data, audioModelCatalog);
  }, [audioModelCatalog, data, effectiveModel]);

  const selectableModels = useMemo(
    () => models.filter((entry) => entry.selectable),
    [models]
  );

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
    return resolveAiAudioReferencedPrompt({
      nodeId,
      edges,
      nodes: typedNodes.map((node) => ({ id: node.id, data: node.data })),
    });
  }, [displayPrompt, edges, hasPromptReference, nodeId, typedNodes]);
  const promptMaxLength = modelRules.promptMaxChars;
  const promptOverLimit =
    promptForGenerate.trim().length > promptMaxLength;

  const handleStaged = useCallback(
    (localMedia: readonly import("@dafthunk/types").LocalMediaReference[]) => {
      if (!updateNodeData || localMedia.length === 0) return;
      updateNodeData(nodeId, (current) => {
        const withPreview = withAiAudioStagingPreview(current, localMedia);
        return {
          ...withPreview,
          metadata: withAiAudioGenerateError(
            withGenerativeProgress(
              withAiAudioGeneratingFlag(current.metadata, true),
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
        withAiAudioGeneratingFlag(metadata, busy),
      onStaged: handleStaged,
    });

  const promptReferenceSourceName = useMemo(() => {
    const edge = edges.find(
      (entry) =>
        entry.target === nodeId &&
        entry.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
    );
    if (!edge) return null;
    const source = typedNodes.find((node) => node.id === edge.source);
    return source?.data.name ?? edge.source;
  }, [edges, nodeId, typedNodes]);

  const promptReferenceEditHint = t("workflow.aiAudioPanel.promptReferenceEditHint", {
    nodeName:
      promptReferenceSourceName ??
      t("workflow.aiAudioPanel.promptReferenceEditHintFallback"),
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
    if (edge?.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID && updateNodeData) {
      updateNodeInput(nodeId, "prompt", "", data.inputs, updateNodeData);
    }
  };

  const handlePickNode = (sourceNodeId: string, sourceHandle: string) => {
    const source = typedNodes.find((node) => node.id === sourceNodeId);
    if (!source) return;

    const verdict = evaluateAiAudioPromptReferenceStructural({
      targetNodeId: nodeId,
      targetNodeMetadata: data.metadata,
      sourceNodeId,
      sourceNodeType: source.data.nodeType,
      edges,
    });
    if (!verdict.ok) {
      toast.error("workflow.aiAudioPanel.referenceRejected");
      return;
    }

    connectReferenceEdge({
      source: sourceNodeId,
      sourceHandle,
      target: nodeId,
      targetHandle: AI_AUDIO_PROMPT_HANDLE_ID,
    });
    setPickNodeOpen(false);
  };

  const handleGenerate = async () => {
    if (disabled || !orgId || !effectiveModel) return;
    if (!modelReady || generateInFlightRef.current) return;

    const prompt = promptForGenerate.trim();

    if (hasPromptReference && !prompt) {
      toast.error("workflow.aiAudioPanel.referencedPromptEmpty");
      return;
    }

    if (
      !canGenerateAiAudio({
        prompt,
        blocksGenerativeMedia,
      })
    ) {
      toast.error("workflow.aiAudioPanel.promptRequired");
      return;
    }

    if (prompt.length > promptMaxLength) {
      toast.error(
        hasPromptReference
          ? "workflow.aiAudioPanel.referencedPromptTooLong"
          : "workflow.generativeErrors.promptTooLong",
        { max: promptMaxLength }
      );
      return;
    }

    generateInFlightRef.current = true;
    setIsGenerating(true);
    const generationValues = cardGenerationParams.visible
      ? cardGenerationParams.values
      : {};
    /** False when another caller owns persist/progress for this job. */
    let ownsJobProgress = true;
    syncProgress({ phase: "generating" });
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiAudioGenerateError(
        withGenerativeProgress(
          withAiAudioGeneratingFlag(current.metadata, true),
          { phase: "generating" }
        ),
        null
      ),
    }));

    try {
      const response = await generateAiAudio(orgId, {
        modelCanonicalId: effectiveModel.canonicalId,
        aiInterfaceId: effectiveModel.interfaceId,
        prompt,
        params: generationValues,
        nodeId,
        workflowId,
        clientRequestId: crypto.randomUUID(),
      });

      let finalAudios = response.audios;
      let finalizeJobId: string | null = null;
      if (response.jobId && response.phase === "ready_to_persist") {
        finalizeJobId = response.jobId;
        const resolvedJob = await resolveJobMedia(response.jobId);
        finalAudios = resolvedJob.media;
        ownsJobProgress = resolvedJob.owned;
        if (!ownsJobProgress) {
          return;
        }
      }
      setPersistPhase(null);
      clearProgress();

      const audio = finalAudios[0];
      if (!audio) {
        throw new Error("Audio generation succeeded without a playable reference");
      }

      if (workflowId && orgId) {
        void ensureGenerativeMediaCached({
          organizationId: orgId,
          workflowId,
          media: audio,
          nodeType: "ai-audio",
        });
      }

      if (!updateNodeData) return;

      const canWriteHistory = tryClaimGenerativeJobFinalize(finalizeJobId ?? "");

      updateNodeData(nodeId, (current) => {
        if (!canWriteHistory) {
          return {
            metadata: withAiAudioGenerateError(
              withAiAudioGeneratingFlag(
                clearGenerativeProgress(current.metadata),
                false
              ),
              null
            ),
          };
        }
        const withResult = appendAiAudioGeneratedHistoryItems(current, [audio], {
          prompt,
          params: generationValues,
          platformModelId: effectiveModel.canonicalId,
          aiInterfaceId: response.aiInterfaceId,
          modelDisplayName: effectiveModel.displayName,
        });
        return {
          ...withResult,
          metadata: withAiAudioGenerateError(
            withAiAudioGeneratingFlag(
              clearGenerativeProgress(withResult.metadata),
              false
            ),
            null
          ),
        };
      });

      if (canWriteHistory) {
        toast.success("workflow.aiAudioPanel.generated");
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
          const audios = resolvedJob.media;
          setPersistPhase(null);
          clearProgress();
          const audio = audios[0];
          if (audio) {
            if (workflowId) {
              void ensureGenerativeMediaCached({
                organizationId: orgId,
                workflowId,
                media: audio,
                nodeType: "ai-audio",
              });
            }
            const canWriteHistory = tryClaimGenerativeJobFinalize(activeJobId);
            updateNodeData(nodeId, (current) => {
              if (!canWriteHistory) {
                return {
                  metadata: withAiAudioGenerateError(
                    withAiAudioGeneratingFlag(
                      clearGenerativeProgress(current.metadata),
                      false
                    ),
                    null
                  ),
                };
              }
              const withResult = appendAiAudioGeneratedHistoryItems(
                current,
                [audio],
                {
                  prompt,
                  params: generationValues,
                  platformModelId: effectiveModel.canonicalId,
                  aiInterfaceId: effectiveModel.interfaceId,
                  modelDisplayName: effectiveModel.displayName,
                }
              );
              return {
                ...withResult,
                metadata: withAiAudioGenerateError(
                  withAiAudioGeneratingFlag(
                    clearGenerativeProgress(withResult.metadata),
                    false
                  ),
                  null
                ),
              };
            });
            if (canWriteHistory) {
              toast.success("workflow.aiAudioPanel.generated");
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
        metadata: withAiAudioGenerateError(
          withAiAudioGeneratingFlag(
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
          metadata: withAiAudioGeneratingFlag(
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
    canGenerateAiAudio({
      prompt: promptForGenerate,
      blocksGenerativeMedia,
    });

  const pickableOutputs = useMemo((): readonly GenerativePickNodeEntry[] => {
    return listPickableAiAudioPromptSources({
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
  }, [edges, nodeId, typedNodes]);

  const canAddReference = pickableOutputs.length > 0;

  return (
    <>
      <GenerativeConfigPanelShell nodeId={nodeId} zoom={zoom} layout={layout}>
        <AiTextReferenceBar
          chips={referenceChips}
          disabled={disabled}
          allowUpload={false}
          addReferenceDisabled={!canAddReference}
          canPickCanvasNode={pickableOutputs.length > 0}
          onDisconnect={handleDisconnectEdge}
          onPickCanvasNode={() => {
            setPickNodeOpen(true);
          }}
          onUploadFiles={() => {}}
        />

        <div
          className="relative mt-2 min-h-0 flex-1"
          style={
            layout === "studio-dock"
              ? undefined
              : { minHeight: AI_AUDIO_PANEL_PROMPT_MIN_HEIGHT_PX }
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
                : t("workflow.aiAudioPanel.promptPlaceholder")
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
                  ? t("workflow.aiAudioPanel.referencedPromptTooLong", {
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

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2">
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
              modelFitsCurrentRefs={modelFitsCurrentRefs}
              onSelect={applyModelSelection}
            />
            {cardGenerationParams.visible ? (
              <AiAudioParamsPopover
                fields={cardGenerationParams.fields}
                values={cardGenerationParams.values}
                disabled={disabled}
                triggerLabel={t("workflow.aiAudioPanel.params")}
                title={t("workflow.aiAudioPanel.paramsTitle")}
                onChange={commitGenerationParams}
              />
            ) : null}
            <div className="min-w-0">
              {models.length > 0 && selectableModels.length === 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("workflow.aiAudioPanel.enableModelsHint")}{" "}
                  <Link
                    to={getOrgUrl("/ai-interfaces")}
                    className="underline underline-offset-2"
                  >
                    {t("workflow.aiAudioPanel.openAiInterfaces")}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>

          <AiGenerateButton
            disabled={!canGenerate}
            isGenerating={isGenerating}
            label={t(generativeAudioProgressButtonKey(activeProgressPhase))}
            onClick={() => {
              void handleGenerate();
            }}
          />
        </div>
      </GenerativeConfigPanelShell>

      <GenerativePickNodeDialog
        open={pickNodeOpen}
        onOpenChange={setPickNodeOpen}
        title={t("workflow.aiAudioPanel.pickCanvasNode")}
        emptyMessage={t("workflow.aiAudioPanel.noPickableNodes")}
        entries={pickableOutputs}
        onPick={handlePickNode}
      />
    </>
  );
}
