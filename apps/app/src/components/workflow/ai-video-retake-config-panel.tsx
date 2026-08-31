import {
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
  type WorkflowMediaValue,
  videoTrimSelectionDurationSec,
} from "@dafthunk/types";
import { useViewport } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/utils/utils";
import { useOrgVideoPickerModels } from "@/services/platform-ai-model-service";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";

import { AiGenerateButton } from "./ai-generate-button";
import { AiTextModelPicker } from "./ai-text-model-picker";
import {
  isAiVideoGenerating,
  readAiVideoCardPrimaryVideo,
  withAiVideoGenerateError,
} from "./ai-video-node-utils";
import { useAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import {
  AiVideoParamsPopover,
  buildDefaultVideoGenerationParams,
} from "./ai-video-params-popover";
import { AiVideoPriceEstimateChip } from "./ai-video-price-estimate-chip";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useGenerativeParamsEditor } from "./use-generative-params-editor";
import { useGenerativeVideoFileUpload } from "./use-generative-video-file-upload";
import { runVideoRetakePipeline } from "./run-video-retake-pipeline";
import { isGenerativeProgressBusyPhase, readGenerativeProgressPhase } from "./generative-progress-utils";
import { isWebCodecsVideoTrimSupported } from "./video-trim-utils";
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

export interface AiVideoRetakeConfigPanelProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
}

export function AiVideoRetakeConfigPanel({
  nodeId,
  data,
}: AiVideoRetakeConfigPanelProps) {
  const { disabled, updateNodeData } = useWorkflow();
  const { zoom } = useViewport();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const toast = useAppToast();
  const { getOrgUrl } = useOrgUrl();
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

  const progressPhase = readGenerativeProgressPhase(data.metadata);
  const isGenerating =
    isAiVideoGenerating(data.metadata) ||
    isGenerativeProgressBusyPhase(progressPhase);

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

  useEffect(() => {
    if (!isRetakePanel || seedance25Models.length === 0) {
      return;
    }
    const currentId = draft.selectedModelOptionId;
    if (
      currentId &&
      seedance25Models.some((model) => model.optionId === currentId)
    ) {
      return;
    }
    patchDraft({
      selectedModelOptionId: seedance25Models[0]?.optionId ?? null,
    });
  }, [
    draft.selectedModelOptionId,
    isRetakePanel,
    patchDraft,
    seedance25Models,
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

  const promptBuffer = useBufferedTextValue(draft.prompt, commitPrompt);
  const prompt = promptBuffer.value.trim();
  const promptOverLimit = prompt.length > promptMaxLength;

  const handleModelSelect = useCallback(
    (optionId: string) => {
      patchDraft({ selectedModelOptionId: optionId });
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

  const canGenerate = Boolean(
    selectedModel &&
      !disabled &&
      !blocksGenerativeMedia &&
      !modelsLoading &&
      prompt.length > 0 &&
      !promptOverLimit &&
      retakeReady &&
      !isStarting &&
      !isGenerating
  );

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !isRetakePanel || isStarting || isGenerating) {
      return;
    }
    if (
      !draft.trimSourceVideoUrl ||
      draft.videoDurationSec === null ||
      !orgId ||
      !workflowId ||
      !sourceMedia
    ) {
      toast.error("workflow.videoRetake.generateFailed");
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

    promptBuffer.flush();
    const flushedPrompt = promptBuffer.value.trim();
    if (!flushedPrompt || !selectedModel) {
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
    try {
      runVideoRetakePipeline({
        organizationId: orgId,
        workflowId,
        targetNodeId: nodeId,
        sourceMedia,
        trimSourceVideoUrl: draft.trimSourceVideoUrl,
        committedRange: {
          startSec: draft.draftRange.startSec,
          endSec: draft.draftRange.endSec,
        },
        videoDurationSec: draft.videoDurationSec,
        highQuality: draft.highQuality,
        mediaKitInterfaceId,
        cloudConfigured,
        prompt: flushedPrompt,
        modelCanonicalId: selectedModel.canonicalId,
        aiInterfaceId: selectedModel.interfaceId,
        instanceId: selectedModel.instanceId.trim() || undefined,
        modelDisplayName: selectedModel.alias,
        supportsTaskCancel: selectedModel.supportsTaskCancel === true,
        generationParams,
        updateNodeData,
        uploadVideoFileToNode,
        t,
        toast,
      });
    } finally {
      setIsStarting(false);
    }
  }, [
    canGenerate,
    cloudConfigured,
    defaultGenerationParams,
    draft,
    isGenerating,
    isRetakePanel,
    isStarting,
    mediaKitInterfaceId,
    mediaKitTrimAvailable,
    nodeId,
    orgId,
    paramPopoverFields,
    paramsEditor,
    promptBuffer,
    selectedModel,
    sourceMedia,
    t,
    toast,
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

  if (!isRetakePanel) {
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
          disabled={disabled || isStarting || isGenerating}
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
              disabled={disabled || isStarting || isGenerating}
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
                disabled={disabled || isStarting || isGenerating}
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
                disabled={disabled || isStarting || isGenerating}
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
          isGenerating={isStarting || isGenerating}
          isCancelling={false}
          canCancel={false}
          label={t("workflow.aiVideoPanel.generate")}
          cancelLabel={t("workflow.generativeCancel.action")}
          onClick={handleGenerate}
          onCancel={() => {}}
        />
      </div>
    </GenerativeConfigPanelShell>
  );
}
