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
  AiVideoParamsPopover,
  buildDefaultVideoGenerationParams,
} from "./ai-video-params-popover";
import { AiVideoPriceEstimateChip } from "./ai-video-price-estimate-chip";
import { GenerativeConfigPanelShell } from "./generative-config-panel-shell";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useGenerativeParamsEditor } from "./use-generative-params-editor";
import { useGenerativeVideoFileUpload } from "./use-generative-video-file-upload";
import { useVideoRetakeToSiblingNode } from "./use-video-trim-to-sibling-node";
import { runVideoRetakePipeline } from "./run-video-retake-pipeline";
import { useVideoRetakeSession } from "./video-retake-session-context";
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
  const { session, patchRetakeSession, closeRetakeSession } =
    useVideoRetakeSession();
  const { createRetakeSiblingNodeShell } = useVideoRetakeToSiblingNode(nodeId);
  const { uploadVideoFileToNode } = useGenerativeVideoFileUpload();
  const { interfaceId: mediaKitInterfaceId, config: mediaKitConfig } =
    useOrgVolcanoMediaKitConfig(orgId);

  const [isStarting, setIsStarting] = useState(false);

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

  const paramsEditor = useGenerativeParamsEditor({
    visible: paramsVisible,
    disabled: disabled || isStarting,
    fields: paramPopoverFields,
    committedValues: committedGenerationValues,
    nodeId,
    nodeInputs: data.inputs,
    modality: "video",
    onCommit: commitGenerationParams,
  });

  const retakeReady =
    session?.sourceNodeId === nodeId &&
    session.loadPhase === "ready" &&
    session.videoDurationSec !== null &&
    session.videoDurationSec > 0;

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
      !isStarting
  );

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !session || isStarting) {
      return;
    }
    if (
      !session.trimSourceVideoUrl ||
      session.videoDurationSec === null ||
      !orgId ||
      !workflowId
    ) {
      return;
    }

    if (session.highQuality) {
      if (!mediaKitTrimAvailable || !mediaKitInterfaceId) {
        toast.error("workflow.videoTrim.notConfiguredHint");
        return;
      }
      const sourceResourceId = getResourceIdFromValue(session.sourceMedia);
      if (
        !sourceResourceId ||
        (session.sourceMedia as { readonly kind?: string }).kind !== "cloud"
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

    setIsStarting(true);
    try {
      const snapshot = {
        sourceMedia: session.sourceMedia,
        trimSourceVideoUrl: session.trimSourceVideoUrl,
        committedRange: {
          startSec: session.draftRange.startSec,
          endSec: session.draftRange.endSec,
        },
        videoDurationSec: session.videoDurationSec,
        highQuality: session.highQuality,
        prompt: flushedPrompt,
        modelCanonicalId: selectedModel.canonicalId,
        aiInterfaceId: selectedModel.interfaceId,
        instanceId: selectedModel.instanceId.trim() || undefined,
        modelDisplayName: selectedModel.alias,
        supportsTaskCancel: selectedModel.supportsTaskCancel === true,
        generationParams,
      };

      const shell = createRetakeSiblingNodeShell();
      if (!shell) {
        toast.error("workflow.videoRetake.createNodeFailed");
        return;
      }

      if (!shell.referenceLinked) {
        toast.error("workflow.videoRetake.referenceLinkFailed");
      }

      closeRetakeSession();

      runVideoRetakePipeline({
        organizationId: orgId,
        workflowId,
        targetNodeId: shell.nodeId,
        sourceMedia: snapshot.sourceMedia,
        trimSourceVideoUrl: snapshot.trimSourceVideoUrl,
        committedRange: snapshot.committedRange,
        videoDurationSec: snapshot.videoDurationSec,
        highQuality: snapshot.highQuality,
        mediaKitInterfaceId,
        cloudConfigured,
        prompt: snapshot.prompt,
        modelCanonicalId: snapshot.modelCanonicalId,
        aiInterfaceId: snapshot.aiInterfaceId,
        instanceId: snapshot.instanceId,
        modelDisplayName: snapshot.modelDisplayName,
        supportsTaskCancel: snapshot.supportsTaskCancel,
        generationParams: snapshot.generationParams,
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
    closeRetakeSession,
    cloudConfigured,
    createRetakeSiblingNodeShell,
    defaultGenerationParams,
    isStarting,
    mediaKitInterfaceId,
    mediaKitTrimAvailable,
    orgId,
    paramPopoverFields,
    paramsEditor,
    promptBuffer,
    selectedModel,
    session,
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
    return [session.sourceMedia as unknown as WorkflowMediaValue];
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
          disabled={disabled || isStarting}
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
              disabled={disabled || isStarting}
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
                disabled={disabled || isStarting}
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
                disabled={disabled || isStarting}
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
          isGenerating={isStarting}
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
