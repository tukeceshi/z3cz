import {
  getSeedanceDefaultParameterRules,
  isSeedance25PlatformModel,
  mergeImageGenerationParams,
  normalizeVideoModelParameterRules,
  readVideoPriceEstimateBaseline480pWithoutVideo,
  readVideoPriceEstimateDisplayFolds,
  readVideoPriceEstimateTier,
  resolveDefaultVideoGenerationResolution,
  type MediaReference,
  type OrgTextModelOption,
  type WorkflowMediaValue,
  VIDEO_DIRECT_CLIENT_POLL_INTERVAL_MS,
  videoTrimSelectionDurationSec,
} from "@dafthunk/types";
import { useViewport } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/utils/utils";
import {
  pollAiVideoTask,
  submitAiVideo,
  useOrgVideoPickerModels,
} from "@/services/platform-ai-model-service";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { persistMediaForNodeInBackground } from "@/services/ensure-resource-cached";
import { resolveMediaReferencesForVideoGenerate } from "@/services/resolve-references-for-generate";
import { tryClaimGenerativeJobFinalize } from "@/services/generative-cloud-job-resume-registry";

import { AiGenerateButton } from "./ai-generate-button";
import { AiTextModelPicker } from "./ai-text-model-picker";
import {
  AiVideoParamsPopover,
  buildDefaultVideoGenerationParams,
} from "./ai-video-params-popover";
import { AiVideoPriceEstimateChip } from "./ai-video-price-estimate-chip";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import {
  appendAiVideoGeneratedHistoryItems,
  isAiVideoGenerating,
  withAiVideoGenerateError,
  withAiVideoGeneratingFlag,
} from "./ai-video-node-utils";
import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import {
  clearGenerativeProgress,
  formatGenerativeBusyOverlayLabel,
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
  withGenerativeProgress,
} from "./generative-progress-utils";
import {
  GenerativeGenerationCancelledError,
  isGenerativeGenerationCancelled,
  showGenerativeCancelledNotice,
} from "./generative-generation-cancel";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { useGenerativeCloudJobProgress } from "@/hooks/use-generative-cloud-job";
import { useGenerativeGenerationSession } from "@/hooks/use-generative-generation-session";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useGenerativeParamsEditor } from "./use-generative-params-editor";
import { useVideoRetakeSession } from "./video-retake-session-context";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

const AI_VIDEO_RETAKE_PROMPT_MIN_HEIGHT_PX = 120 as const;
const VIDEO_POLL_INTERVAL_MS = VIDEO_DIRECT_CLIENT_POLL_INTERVAL_MS;
const VIDEO_POLL_MAX_ATTEMPTS = 120;
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

export interface AiVideoRetakeConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

async function pollUntilVideoReady(
  orgId: string,
  taskId: string,
  aiInterfaceId: string,
  modelCanonicalId: string,
  workflowId: string | undefined,
  onPhase?: (phase: "queued" | "generating") => void,
  options?: {
    readonly signal?: AbortSignal;
    readonly shouldAbort?: () => boolean;
  }
): Promise<MediaReference> {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (options?.shouldAbort?.() || options?.signal?.aborted) {
      throw new GenerativeGenerationCancelledError();
    }

    const result = await pollAiVideoTask(orgId, taskId, aiInterfaceId, {
      workflowId,
      modelCanonicalId,
      signal: options?.signal,
    });
    if (result.status === "succeeded") {
      const stored = result.videos?.[0];
      if (stored) {
        return stored;
      }
      throw new Error("Video generation succeeded without a playable reference");
    }
    if (result.status === "cancelled") {
      throw new GenerativeGenerationCancelledError();
    }
    if (result.status === "failed" || result.status === "expired") {
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

function generativeVideoProgressButtonKey(
  phase: ReturnType<typeof readGenerativeProgressPhase>
): string {
  if (phase === "queued") {
    return "workflow.aiVideoPanel.queued";
  }
  if (phase === "generating") {
    return "workflow.aiVideoPanel.generating";
  }
  if (phase === "cancelling") {
    return "workflow.generativeCancel.cancelling";
  }
  return "workflow.aiVideoPanel.generate";
}

export function AiVideoRetakeConfigPanel({
  nodeId,
  data,
}: AiVideoRetakeConfigPanelProps) {
  const { updateNodeData, disabled } = useWorkflow();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const toast = useAppToast();
  const { getOrgUrl } = useOrgUrl();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const { session, patchRetakeSession } = useVideoRetakeSession();

  const [isGenerating, setIsGenerating] = useState(false);
  const generateInFlightRef = useRef(false);
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());

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
    if (!session?.selectedModelOptionId) {
      return seedance25Models[0] ?? null;
    }
    return (
      seedance25Models.find(
        (model) => model.optionId === session.selectedModelOptionId
      ) ??
      seedance25Models[0] ??
      null
    );
  }, [seedance25Models, session?.selectedModelOptionId]);

  useEffect(() => {
    if (!session || seedance25Models.length === 0) {
      return;
    }
    const currentId = session.selectedModelOptionId;
    if (
      currentId &&
      seedance25Models.some((model) => model.optionId === currentId)
    ) {
      return;
    }
    patchRetakeSession({
      selectedModelOptionId: seedance25Models[0]?.optionId ?? null,
    });
  }, [
    patchRetakeSession,
    seedance25Models,
    session,
    session?.selectedModelOptionId,
  ]);

  const modelRules = useMemo(() => {
    if (selectedModel) {
      return normalizeVideoModelParameterRules(selectedModel.parameterRules);
    }
    const fallbackCanonicalId = seedance25Models[0]?.canonicalId;
    const fallbackRules = fallbackCanonicalId
      ? getSeedanceDefaultParameterRules(fallbackCanonicalId)
      : undefined;
    return fallbackRules
      ? normalizeVideoModelParameterRules(fallbackRules)
      : null;
  }, [seedance25Models, selectedModel]);

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
      session?.generationParams.resolution !== undefined &&
      session.generationParams.resolution !== null &&
      String(session.generationParams.resolution).trim().length > 0;
    if (hasUserResolution) {
      return base;
    }
    const resolution = resolveDefaultVideoGenerationResolution({
      width: session?.sourceVideoWidth,
      height: session?.sourceVideoHeight,
      allowedValues: allowedResolutions,
      fallback: fallbackResolution,
    });
    return {
      ...base,
      resolution,
    };
  }, [
    modelRules,
    session?.generationParams.resolution,
    session?.sourceVideoHeight,
    session?.sourceVideoWidth,
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
      ...session?.generationParams,
    });
  }, [
    defaultGenerationParams,
    paramPopoverFields,
    paramsVisible,
    session?.generationParams,
  ]);

  const commitGenerationParams = useCallback(
    (next: Record<string, unknown>) => {
      patchRetakeSession({ generationParams: next });
    },
    [patchRetakeSession]
  );

  const promptMaxLength = modelRules?.promptMaxChars ?? 1000;

  const commitPrompt = useCallback(
    (value: string) => {
      patchRetakeSession({ prompt: value });
    },
    [patchRetakeSession]
  );

  const promptBuffer = useBufferedTextValue(session?.prompt ?? "", commitPrompt);
  const prompt = promptBuffer.value.trim();
  const promptOverLimit = prompt.length > promptMaxLength;

  const handleModelSelect = useCallback(
    (optionId: string) => {
      patchRetakeSession({ selectedModelOptionId: optionId });
    },
    [patchRetakeSession]
  );

  const applyCancelledUiState = useCallback(() => {
    setIsGenerating(false);
    generateInFlightRef.current = false;
    updateNodeData?.(nodeId, (current) => ({
      metadata: withAiVideoGenerateError(
        withAiVideoGeneratingFlag(clearGenerativeProgress(current.metadata), false),
        null
      ),
    }));
    showGenerativeCancelledNotice(nodeId);
  }, [nodeId, updateNodeData]);

  const {
    beginSession,
    trackJobId,
    trackClientRequestId,
    isCancelConfirmed,
    isCancelling,
    shouldAbortJobPoll,
  } = useGenerativeGenerationSession({
    nodeId,
    orgId,
    metadata: data.metadata,
    onCancelConfirmed: applyCancelledUiState,
    onCancelNotApplied: () => {},
    setIsGenerating,
    setPersistPhase: () => {},
    generateInFlightRef,
  });

  const metadataProgressPhase = readGenerativeProgressPhase(data.metadata);
  const metadataBusy =
    isAiVideoGenerating(data.metadata) ||
    isGenerativeProgressBusyPhase(metadataProgressPhase);
  const isBusyForUi = isGenerating || isCancelling || metadataBusy;

  const paramsEditor = useGenerativeParamsEditor({
    visible: paramsVisible,
    disabled: disabled || isBusyForUi,
    fields: paramPopoverFields,
    committedValues: committedGenerationValues,
    nodeId,
    nodeInputs: data.inputs,
    modality: "video",
    onCommit: commitGenerationParams,
  });

  const {
    syncProgress,
    clearProgress,
    resolveJobMedia,
    activeProgressPhase,
  } = useGenerativeCloudJobProgress({
    nodeId,
    orgId,
    workflowId,
    cloudConfigured,
    metadata: data.metadata,
    isGenerating: isBusyForUi,
    persistPhase: null,
    autoResume: false,
    updateNodeData,
    setPersistPhase: () => {},
    setIsGenerating,
    applyBusyMetadata: (metadata, busy) =>
      withAiVideoGeneratingFlag(metadata, busy),
    shouldAbortJobPoll,
    cloudAccelerationEnabled: false,
    aiInterfaceId: selectedModel?.interfaceId,
  });

  const progressButtonLabel = useMemo(() => {
    if (isCancelling || activeProgressPhase === "cancelling") {
      return t(generativeVideoProgressButtonKey("cancelling"));
    }
    if (!activeProgressPhase) {
      return t("workflow.aiVideoPanel.generate");
    }
    return formatGenerativeBusyOverlayLabel({
      phase: activeProgressPhase,
      progressButtonKey: generativeVideoProgressButtonKey,
      i18nPrefix: "workflow.aiVideoPanel",
      metadata: data.metadata,
      progressNowMs,
      t,
    });
  }, [activeProgressPhase, data.metadata, isCancelling, progressNowMs, t]);

  const canGenerate = Boolean(
    selectedModel &&
      !disabled &&
      !blocksGenerativeMedia &&
      !modelsLoading &&
      prompt.length > 0 &&
      !promptOverLimit &&
      !isBusyForUi
  );

  const handleGenerate = useCallback(async () => {
    if (
      !canGenerate ||
      !orgId ||
      !workflowId ||
      !updateNodeData ||
      !selectedModel ||
      !session ||
      generateInFlightRef.current
    ) {
      return;
    }

    generateInFlightRef.current = true;
    setIsGenerating(true);
    const signal = beginSession();
    const clientRequestId = crypto.randomUUID();
    trackClientRequestId(clientRequestId);
    syncProgress({ phase: "generating" });

    updateNodeData(nodeId, (current) => ({
      metadata: withAiVideoGenerateError(
        withGenerativeProgress(
          withAiVideoGeneratingFlag(current.metadata, true),
          { phase: "generating" }
        ),
        null
      ),
    }));

    try {
      const resolved = await resolveMediaReferencesForVideoGenerate({
        organizationId: orgId,
        workflowId,
        cloudConfigured,
        references: [session.sourceMedia],
      });

      const visibleGenerationValues = paramsEditor.flushBeforeGenerate();
      const mergedGenerationParams = mergeImageGenerationParams(
        allGenerationFields,
        {
          ...defaultGenerationParams,
          ...visibleGenerationValues,
        }
      );

      const submitPayload = {
        modelCanonicalId: selectedModel.canonicalId,
        aiInterfaceId: selectedModel.interfaceId,
        ...(selectedModel.instanceId.trim()
          ? { instanceId: selectedModel.instanceId.trim() }
          : {}),
        prompt,
        params: mergedGenerationParams,
        referenceVideoUrls:
          resolved.referenceVideoUrls.length > 0
            ? resolved.referenceVideoUrls
            : undefined,
        nodeId,
        workflowId,
        clientRequestId,
      } as const;

      const submitResponse = await submitAiVideo(orgId, submitPayload, { signal });

      if (isCancelConfirmed()) {
        throw new GenerativeGenerationCancelledError();
      }

      let video: MediaReference | null = null;
      let jobId: string | null = null;
      let owned = true;

      if (submitResponse.jobId) {
        jobId = submitResponse.jobId;
        trackJobId(submitResponse.jobId);
        if (submitResponse.workflowNodeContent) {
          updateNodeData(nodeId, (current) => ({
            ...applyWorkflowNodeContentPatch(
              current,
              submitResponse.workflowNodeContent!
            ),
            metadata: withGenerativeProgress(
              withAiVideoGeneratingFlag(current.metadata, true),
              { jobId: submitResponse.jobId, phase: "generating" }
            ),
          }));
        }
        syncProgress({ jobId: submitResponse.jobId, phase: "generating" });
        const resolvedJob = await resolveJobMedia(submitResponse.jobId);
        owned = resolvedJob.owned;
        video = resolvedJob.media[0] ?? null;
      } else if (submitResponse.taskId) {
        video = await pollUntilVideoReady(
          orgId,
          submitResponse.taskId,
          submitResponse.aiInterfaceId,
          submitPayload.modelCanonicalId,
          workflowId,
          (phase) => syncProgress({ phase }),
          { signal, shouldAbort: isCancelConfirmed }
        );
      }

      if (owned && !video) {
        throw new Error("Video generation succeeded without a playable reference");
      }

      if (!owned) {
        return;
      }

      const canWriteHistory =
        video !== null &&
        (!jobId || tryClaimGenerativeJobFinalize(jobId));

      if (canWriteHistory && workflowId && orgId && video) {
        persistMediaForNodeInBackground({
          organizationId: orgId,
          workflowId,
          media: [video],
          nodeType: "ai-video",
          cloudConfigured,
        });
      }

      updateNodeData(nodeId, (current) => {
        if (!canWriteHistory || !video) {
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

        const withResult = appendAiVideoGeneratedHistoryItems(current, [video], {
          prompt,
          params: mergedGenerationParams,
          platformModelId: selectedModel.canonicalId,
          aiInterfaceId: selectedModel.interfaceId,
          modelDisplayName: selectedModel.alias,
          jobId: jobId ?? undefined,
        });

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
      clearProgress();
    } catch (error) {
      if (isGenerativeGenerationCancelled(error) || isCancelConfirmed()) {
        applyCancelledUiState();
        return;
      }
      const formatted = prepareGenerativeCardError(
        error instanceof Error ? error.message : t("workflow.aiVideoPanel.generateFailed"),
        t,
        "video"
      );
      updateNodeData(nodeId, (current) => ({
        metadata: withAiVideoGenerateError(
          withAiVideoGeneratingFlag(
            clearGenerativeProgress(current.metadata),
            false
          ),
          formatted
        ),
      }));
      toast.errorRaw(formatted.summary);
    } finally {
      generateInFlightRef.current = false;
      setIsGenerating(false);
    }
  }, [
    applyCancelledUiState,
    beginSession,
    canGenerate,
    clearProgress,
    cloudConfigured,
    allGenerationFields,
    defaultGenerationParams,
    isCancelConfirmed,
    paramsEditor,
    nodeId,
    orgId,
    prompt,
    resolveJobMedia,
    selectedModel,
    session,
    syncProgress,
    t,
    toast,
    trackClientRequestId,
    trackJobId,
    updateNodeData,
    workflowId,
  ]);

  const generationValuesForEstimate = useMemo(() => {
    const merged = mergeImageGenerationParams(allGenerationFields, {
      ...defaultGenerationParams,
      ...paramsEditor.effectiveValues,
    });
    if (!session || session.sourceNodeId !== nodeId) {
      return merged;
    }
    return {
      ...merged,
      duration: videoTrimSelectionDurationSec(session.draftRange),
    };
  }, [
    allGenerationFields,
    defaultGenerationParams,
    nodeId,
    paramsEditor.effectiveValues,
    session,
  ]);

  const referenceVideoMedia = useMemo((): readonly WorkflowMediaValue[] => {
    if (!session || session.sourceNodeId !== nodeId) {
      return [];
    }
    return [session.sourceMedia as WorkflowMediaValue];
  }, [nodeId, session]);

  const referenceVideoDurationSec = useMemo(() => {
    if (!session || session.sourceNodeId !== nodeId) {
      return undefined;
    }
    return videoTrimSelectionDurationSec(session.draftRange);
  }, [nodeId, session]);

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

  if (!session || session.sourceNodeId !== nodeId) {
    return null;
  }

  return (
    <GenerativeConfigPanelShell nodeId={nodeId} zoom={zoom} layout="retake-embedded">
      <div
        className="relative min-h-0"
        style={{ minHeight: AI_VIDEO_RETAKE_PROMPT_MIN_HEIGHT_PX }}
      >
        <Textarea
          value={promptBuffer.value}
          disabled={disabled || isBusyForUi}
          placeholder={t("workflow.aiVideoPanel.promptPlaceholder")}
          className={cn(
            "min-h-[120px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          )}
          onChange={(event) => promptBuffer.onChange(event.target.value)}
          onFocus={promptBuffer.onFocus}
          onBlur={promptBuffer.onBlur}
          onCompositionStart={promptBuffer.onCompositionStart}
          onCompositionEnd={promptBuffer.onCompositionEnd}
        />
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-end gap-2">
            <AiTextModelPicker
              orgId={orgId}
              models={seedance25Models as unknown as readonly OrgTextModelOption[]}
              selectedOptionId={selectedModel?.optionId ?? ""}
              chipModel={selectedModel as unknown as OrgTextModelOption | undefined}
              disabled={disabled || isBusyForUi}
              isLoading={modelsLoading}
              loadError={Boolean(modelsError)}
              onOpenChange={() => {}}
              onRetryLoad={() => {
                void refreshModels();
              }}
              modelFitsCurrentRefs={() => true}
              onSelect={handleModelSelect}
            />
            {paramsVisible ? (
              <AiVideoParamsPopover
                fields={paramPopoverFields}
                disabled={disabled || isBusyForUi}
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
                disabled={disabled || isBusyForUi}
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
          {promptOverLimit ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              {t("workflow.generativeErrors.promptTooLong", { max: promptMaxLength })}
            </p>
          ) : null}
        </div>

        <AiGenerateButton
          disabled={!canGenerate}
          isGenerating={isBusyForUi}
          isCancelling={isCancelling}
          canCancel={false}
          label={progressButtonLabel}
          cancelLabel={t("workflow.generativeCancel.action")}
          onClick={() => {
            void handleGenerate();
          }}
          onCancel={() => {}}
        />
      </div>
    </GenerativeConfigPanelShell>
  );
}
