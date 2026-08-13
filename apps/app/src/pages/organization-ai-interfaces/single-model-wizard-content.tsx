import {
  buildSingleModelProviderMetadata,
  createEmptyPresetSelection,
  endpointRulesForMetadata,
  DEEPSEEK_DEFAULT_ENDPOINT_URL,
  DEEPSEEK_PROVIDER_CARD_ID,
  getSingleModelPresetById,
  GLM_DEFAULT_ENDPOINT_URL,
  GLM_PROVIDER_CARD_ID,
  GEMINI_DEFAULT_ENDPOINT_URL,
  GEMINI_PROVIDER_CARD_ID,
  CLAUDE_DEFAULT_ENDPOINT_URL,
  CLAUDE_PROVIDER_CARD_ID,
  GROK_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_IMAGE_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  isMultiModelProviderSelection,
  KIMI_DEFAULT_ENDPOINT_URL,
  KIMI_PROVIDER_CARD_ID,
  MINIMAX_SPEECH_DEFAULT_ENDPOINT_URL,
  MINIMAX_SPEECH_PROVIDER_CARD_ID,
  NANO_BANANA_DEFAULT_ENDPOINT_URL,
  NANO_BANANA_PROVIDER_CARD_ID,
  VEO_DEFAULT_ENDPOINT_URL,
  VEO_PROVIDER_CARD_ID,
  OPENAI_DEFAULT_ENDPOINT_URL,
  OPENAI_IMAGE_DEFAULT_ENDPOINT_URL,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  SEEDANCE_DEFAULT_ENDPOINT_URL,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_DEFAULT_ENDPOINT_URL,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_DEFAULT_ENDPOINT_URL,
  SEEDREAM_PROVIDER_CARD_ID,
  prepareSingleModelInstancesForSave,
  type SingleModelInstanceDraft,
  type SingleModelCapabilityLimits,
  type SingleModelFormatTransform,
  type SingleModelPresetEntry,
  type SingleModelWizardSelection,
  validateCustomSingleModelEndpointRules,
} from "@dafthunk/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import {
  CredentialPlainInput,
  CredentialSecretInput,
} from "@/components/credential-secret-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  createOrganizationAiInterface,
  useOrganizationFormatTransformTemplates,
} from "@/services/organization-ai-interface-service";
import {
  usePlatformCatalogAudioModels,
  usePlatformCatalogImageModels,
  usePlatformCatalogTextModels,
  usePlatformCatalogVideoModels,
  usePlatformVideoModelBaselines,
} from "@/services/platform-ai-model-service";
import { cn } from "@/utils/utils";

import { CapabilityLimitsSettingsDialog } from "./capability-limits-settings-dialog";
import { KimiEndpointRegionHints } from "./kimi-endpoint-region-hints";
import {
  SingleModelInstanceList,
  type ProviderModelPoolOption,
} from "./single-model-instance-list";
import {
  createDefaultEndpointRulesFormState,
  SingleModelEndpointRulesFields,
  type SingleModelEndpointRulesFormState,
} from "./single-model-endpoint-rules-fields";
import {
  SingleModelVideoEndpointUrlFields,
} from "./single-model-endpoint-url-preview";
import {
  resolveDefaultInterfaceListName,
} from "./single-model-display-name";
import {
  isSingleModelSelectionValid,
  SingleModelPickerStep,
} from "./single-model-picker-step";
import {
  listPresetAvailableModels,
  useApiPresetChannelIdMap,
} from "./use-preset-channel-model-ids";

interface SingleModelWizardContentProps {
  organizationId: string;
  step: number;
  onStepChange: (step: number) => void;
  onBackFromFirstStep: () => void;
  onComplete: () => Promise<void>;
  onCancel: () => void;
}

function applyPresetDefaults(preset: SingleModelPresetEntry): {
  endpointUrl: string;
  selectedModel: string;
} {
  return {
    endpointUrl: preset.defaultEndpointUrl,
    selectedModel: preset.defaultModelId ?? preset.canonicalId ?? "",
  };
}

function buildMetadataModelsFromInstances(
  instances: readonly SingleModelInstanceDraft[],
  applyCustomVideoRules: boolean
) {
  return instances.map((instance) => ({
    instanceId: instance.instanceId,
    canonicalId: instance.canonicalId,
    upstreamModelId: instance.upstreamModelId.trim(),
    enabled: instance.enabled,
    modality: instance.modality,
    ...(instance.displayName.trim()
      ? { alias: instance.displayName.trim() }
      : {}),
    ...(instance.capabilityLimits
      ? { capabilityLimits: instance.capabilityLimits }
      : {}),
    ...(applyCustomVideoRules &&
    instance.modality === "video" &&
    instance.formatTransform
      ? { formatTransform: instance.formatTransform }
      : {}),
  }));
}

export function SingleModelWizardContent({
  organizationId,
  step,
  onStepChange,
  onBackFromFirstStep,
  onComplete,
  onCancel,
}: SingleModelWizardContentProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { models: platformModels } = usePlatformCatalogTextModels(organizationId);
  const { models: imagePlatformModels } = usePlatformCatalogImageModels(organizationId);
  const { models: videoPlatformModels } = usePlatformCatalogVideoModels(organizationId);
  const { models: audioPlatformModels } = usePlatformCatalogAudioModels(organizationId);
  const { presetChannelIds: apiPresetChannelIds } =
    useApiPresetChannelIdMap(organizationId);

  const deepSeekAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        DEEPSEEK_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const seedanceAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        SEEDANCE_PROVIDER_CARD_ID,
        videoPlatformModels
      ),
    [apiPresetChannelIds, videoPlatformModels]
  );

  const veoAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        VEO_PROVIDER_CARD_ID,
        videoPlatformModels
      ),
    [apiPresetChannelIds, videoPlatformModels]
  );

  const seedreamAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        SEEDREAM_PROVIDER_CARD_ID,
        imagePlatformModels
      ),
    [apiPresetChannelIds, imagePlatformModels]
  );

  const seedAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        SEED_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const glmAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        GLM_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const kimiAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        KIMI_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const openAiAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        OPENAI_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const geminiAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        GEMINI_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const grokAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        GROK_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const claudeAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        CLAUDE_PROVIDER_CARD_ID,
        platformModels
      ),
    [apiPresetChannelIds, platformModels]
  );

  const grokImagineImageAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
        imagePlatformModels
      ),
    [apiPresetChannelIds, imagePlatformModels]
  );

  const grokImagineVideoAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
        videoPlatformModels
      ),
    [apiPresetChannelIds, videoPlatformModels]
  );

  const minimaxSpeechAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        MINIMAX_SPEECH_PROVIDER_CARD_ID,
        audioPlatformModels
      ),
    [apiPresetChannelIds, audioPlatformModels]
  );

  const openAiImageAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        OPENAI_IMAGE_PROVIDER_CARD_ID,
        imagePlatformModels
      ),
    [apiPresetChannelIds, imagePlatformModels]
  );

  const nanoBananaAvailableModels = useMemo(
    () =>
      listPresetAvailableModels(
        apiPresetChannelIds,
        NANO_BANANA_PROVIDER_CARD_ID,
        imagePlatformModels
      ),
    [apiPresetChannelIds, imagePlatformModels]
  );

  const [selection, setSelection] = useState<SingleModelWizardSelection>(
    createEmptyPresetSelection()
  );
  const [endpointUrl, setEndpointUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [modelInstances, setModelInstances] = useState<
    SingleModelInstanceDraft[]
  >([]);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [endpointRulesForm, setEndpointRulesForm] =
    useState<SingleModelEndpointRulesFormState>(() =>
      createDefaultEndpointRulesFormState()
    );
  const [capabilityLimitsByInstanceId, setCapabilityLimitsByInstanceId] =
    useState<Record<string, SingleModelCapabilityLimits | null>>({});
  const [sharedFormatTransform, setSharedFormatTransform] =
    useState<SingleModelFormatTransform | null>(null);
  const [capabilitySettingsInstanceId, setCapabilitySettingsInstanceId] =
    useState<string | null>(null);
  const { formatTemplates, isFormatTemplatesLoading } =
    useOrganizationFormatTransformTemplates(organizationId);
  const { baselines: platformBaselines, isBaselinesLoading } =
    usePlatformVideoModelBaselines(step === 2 ? organizationId : undefined);

  const selectedPreset = useMemo(() => {
    if (selection.kind !== "preset") {
      return undefined;
    }
    return getSingleModelPresetById(selection.presetId);
  }, [selection]);

  const wizardSelectionKey = useMemo((): string | null => {
    if (selection.kind === "preset") {
      return `preset:${selection.presetId}`;
    }
    if (isMultiModelProviderSelection(selection)) {
      return `multi:${selection.kind}`;
    }
    return null;
  }, [selection]);

  const initializedWizardSelectionRef = useRef<string | null>(null);

  const multiModelProviderConfig = useMemo(() => {
    if (selection.kind === "deepseek") {
      return {
        presetId: DEEPSEEK_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: DEEPSEEK_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.deepseekProvider" as const,
        availableModels: deepSeekAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "seed") {
      return {
        presetId: SEED_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: SEED_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.seedProvider" as const,
        availableModels: seedAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "glm") {
      return {
        presetId: GLM_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: GLM_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.glmProvider" as const,
        availableModels: glmAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "kimi") {
      return {
        presetId: KIMI_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: KIMI_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.kimiProvider" as const,
        availableModels: kimiAvailableModels,
        showEndpointRegionHints: true,
      };
    }
    if (selection.kind === "openai") {
      return {
        presetId: OPENAI_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: OPENAI_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.openaiProvider" as const,
        availableModels: openAiAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "gemini") {
      return {
        presetId: GEMINI_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: GEMINI_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.geminiProvider" as const,
        availableModels: geminiAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "grok") {
      return {
        presetId: GROK_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: GROK_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.grokProvider" as const,
        availableModels: grokAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "claude") {
      return {
        presetId: CLAUDE_PROVIDER_CARD_ID,
        category: "text" as const,
        defaultEndpoint: CLAUDE_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.claudeProvider" as const,
        availableModels: claudeAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "seedance") {
      return {
        presetId: SEEDANCE_PROVIDER_CARD_ID,
        category: "video" as const,
        defaultEndpoint: SEEDANCE_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.seedanceProvider" as const,
        availableModels: seedanceAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "veo") {
      return {
        presetId: VEO_PROVIDER_CARD_ID,
        category: "video" as const,
        defaultEndpoint: VEO_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.veoProvider" as const,
        availableModels: veoAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "grok-imagine-video") {
      return {
        presetId: GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
        category: "video" as const,
        defaultEndpoint: GROK_IMAGINE_VIDEO_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.grokImagineVideoProvider" as const,
        availableModels: grokImagineVideoAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "minimax-speech") {
      return {
        presetId: MINIMAX_SPEECH_PROVIDER_CARD_ID,
        category: "audio" as const,
        defaultEndpoint: MINIMAX_SPEECH_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.minimaxSpeechProvider" as const,
        availableModels: minimaxSpeechAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "seedream") {
      return {
        presetId: SEEDREAM_PROVIDER_CARD_ID,
        category: "image" as const,
        defaultEndpoint: SEEDREAM_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.seedreamProvider" as const,
        availableModels: seedreamAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "openai-image") {
      return {
        presetId: OPENAI_IMAGE_PROVIDER_CARD_ID,
        category: "image" as const,
        defaultEndpoint: OPENAI_IMAGE_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.openaiImageProvider" as const,
        availableModels: openAiImageAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "nano-banana") {
      return {
        presetId: NANO_BANANA_PROVIDER_CARD_ID,
        category: "image" as const,
        defaultEndpoint: NANO_BANANA_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.nanoBananaProvider" as const,
        availableModels: nanoBananaAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    if (selection.kind === "grok-imagine-image") {
      return {
        presetId: GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
        category: "image" as const,
        defaultEndpoint: GROK_IMAGINE_IMAGE_DEFAULT_ENDPOINT_URL,
        listNameKey: "pages.aiInterfaces.singleModel.presets.grokImagineImageProvider" as const,
        availableModels: grokImagineImageAvailableModels,
        showEndpointRegionHints: false,
      };
    }
    return null;
  }, [
    deepSeekAvailableModels,
    glmAvailableModels,
    geminiAvailableModels,
    grokAvailableModels,
    claudeAvailableModels,
    grokImagineImageAvailableModels,
    grokImagineVideoAvailableModels,
    minimaxSpeechAvailableModels,
    kimiAvailableModels,
    nanoBananaAvailableModels,
    openAiAvailableModels,
    openAiImageAvailableModels,
    seedAvailableModels,
    seedanceAvailableModels,
    veoAvailableModels,
    seedreamAvailableModels,
    selection.kind,
  ]);

  const endpointRulesCategory =
    multiModelProviderConfig?.category ?? selectedPreset?.category ?? "text";

  const baselineById = useMemo(
    () =>
      new Map(
        platformBaselines.map((baseline) => [baseline.canonicalId, baseline])
      ),
    [platformBaselines]
  );

  const modelPoolOptions = useMemo((): readonly ProviderModelPoolOption[] => {
    if (!multiModelProviderConfig) {
      return [];
    }
    return multiModelProviderConfig.availableModels.map((model) => ({
      canonicalId: model.canonicalId,
      displayName: model.displayName,
      modality: model.modality,
    }));
  }, [multiModelProviderConfig]);

  const isVideoCategory = endpointRulesCategory === "video";

  const capabilitySettingsLabel = t(
    "pages.aiInterfaces.singleModel.capabilityLimitsSettingsTitle"
  );

  const singlePresetVideoCanonicalId =
    selectedPreset?.category === "video"
      ? (selectedPreset.canonicalId ??
        selectedPreset.id.replace(/^preset:/, ""))
      : null;

  const capabilitySettingsModelLabel = useMemo(() => {
    if (!capabilitySettingsInstanceId) {
      return "";
    }
    const instance = modelInstances.find(
      (entry) => entry.instanceId === capabilitySettingsInstanceId
    );
    if (instance) {
      return instance.displayName;
    }
    if (
      singlePresetVideoCanonicalId === capabilitySettingsInstanceId &&
      selectedPreset
    ) {
      return resolveDefaultInterfaceListName({ preset: selectedPreset, t });
    }
    return capabilitySettingsInstanceId;
  }, [
    capabilitySettingsInstanceId,
    modelInstances,
    selectedPreset,
    singlePresetVideoCanonicalId,
    t,
  ]);

  const capabilitySettingsBaseline = useMemo(() => {
    if (!capabilitySettingsInstanceId) {
      return null;
    }
    const instance = modelInstances.find(
      (entry) => entry.instanceId === capabilitySettingsInstanceId
    );
    if (instance) {
      return baselineById.get(instance.canonicalId) ?? null;
    }
    if (singlePresetVideoCanonicalId) {
      return baselineById.get(singlePresetVideoCanonicalId) ?? null;
    }
    return null;
  }, [
    baselineById,
    capabilitySettingsInstanceId,
    modelInstances,
    singlePresetVideoCanonicalId,
  ]);

  const resolvePresetListName = (preset: SingleModelPresetEntry): string =>
    resolveDefaultInterfaceListName({ preset, t });

  useEffect(() => {
    if (!wizardSelectionKey) {
      return;
    }
    if (initializedWizardSelectionRef.current === wizardSelectionKey) {
      return;
    }
    initializedWizardSelectionRef.current = wizardSelectionKey;

    if (multiModelProviderConfig) {
      setEndpointUrl(multiModelProviderConfig.defaultEndpoint);
      setSelectedModel("");
      setName(t(multiModelProviderConfig.listNameKey));
      setApiKey("");
      setEndpointRulesForm(createDefaultEndpointRulesFormState());
      setModelInstances([]);
      setSharedFormatTransform(null);
      setCapabilityLimitsByInstanceId({});
      setCapabilitySettingsInstanceId(null);
      return;
    }

    if (!selectedPreset) {
      return;
    }

    const defaults = applyPresetDefaults(selectedPreset);
    setEndpointUrl(defaults.endpointUrl);
    setSelectedModel(defaults.selectedModel);
    setName(resolvePresetListName(selectedPreset));
    setModelInstances([]);
    setApiKey("");
    setEndpointRulesForm(createDefaultEndpointRulesFormState());
    setSharedFormatTransform(null);
    setCapabilityLimitsByInstanceId({});
    setCapabilitySettingsInstanceId(null);
  }, [wizardSelectionKey, multiModelProviderConfig, selectedPreset, t]);

  const canProceedStep1 = isSingleModelSelectionValid(selection);

  const canProceedStep2 = useMemo(() => {
    if (!endpointUrl.trim()) {
      return false;
    }

    if (isMultiModelProviderSelection(selection)) {
      if (!apiKey.trim()) {
        return false;
      }
      if (!name.trim()) {
        return false;
      }
      return modelInstances.some(
        (instance) => instance.enabled && instance.upstreamModelId.trim().length > 0
      );
    }

    if (!apiKey.trim()) {
      return false;
    }
    if (!selectedModel.trim()) {
      return false;
    }
    return name.trim().length > 0;
  }, [apiKey, endpointUrl, modelInstances, name, selectedModel, selection]);

  const handleSave = async () => {
    if (!endpointUrl.trim()) {
      appToast.error("pages.aiInterfaces.singleModel.endpointRequired");
      return;
    }

    const endpointRules = endpointRulesForMetadata({
      useOfficial: endpointRulesForm.useOfficial,
      useFullSubmitUrl: endpointRulesForm.useFullSubmitUrl,
    });
    const endpointRulesValidation = validateCustomSingleModelEndpointRules({
      category: endpointRulesCategory,
      rules: endpointRules ?? { useOfficial: true },
    });
    if (endpointRulesValidation) {
      appToast.errorRaw(endpointRulesValidation);
      return;
    }

    if (
      endpointRulesCategory === "video" &&
      !endpointRulesForm.useOfficial
    ) {
      if (!sharedFormatTransform) {
        appToast.error("pages.aiInterfaces.singleModel.formatTemplateRequired");
        return;
      }
    }

    setIsSaving(true);
    try {
      let created = false;
      const baseUrl = endpointUrl.trim();

      if (multiModelProviderConfig && isMultiModelProviderSelection(selection)) {
        if (!apiKey.trim()) {
          appToast.error("pages.aiInterfaces.apiKeyRequired");
          return;
        }
        if (!name.trim()) {
          appToast.error("pages.aiInterfaces.nameTemplateRequired");
          return;
        }
        if (
          !modelInstances.some(
            (instance) => instance.enabled && instance.upstreamModelId.trim()
          )
        ) {
          appToast.error("pages.aiInterfaces.singleModel.modelIdRequired");
          return;
        }

        const applyCustomVideoRules =
          endpointRulesCategory === "video" && !endpointRulesForm.useOfficial;
        const preparedInstances = prepareSingleModelInstancesForSave({
          instances: modelInstances,
          sharedFormatTransform,
          capabilityLimitsByInstanceId,
          applyCustomVideoRules,
        });

        await createOrganizationAiInterface(organizationId, {
          provider: "custom",
          name: name.trim(),
          apiKey: apiKey.trim(),
          baseUrl,
          selectedModel: null,
          metadata: buildSingleModelProviderMetadata({
            singleModelPresetId: multiModelProviderConfig.presetId,
            singleModelCategory: multiModelProviderConfig.category,
            models: buildMetadataModelsFromInstances(
              preparedInstances,
              applyCustomVideoRules
            ),
            endpointRules,
          }),
          enabled: true,
          isDefault: false,
        });
        created = true;
      } else if (selectedPreset) {
        if (!apiKey.trim()) {
          appToast.error("pages.aiInterfaces.apiKeyRequired");
          return;
        }
        if (!name.trim()) {
          appToast.error("pages.aiInterfaces.nameTemplateRequired");
          return;
        }
        const presetCanonicalId =
          selectedPreset.canonicalId ??
          selectedPreset.id.replace(/^preset:/, "");
        const applyCustomVideoRules =
          endpointRulesCategory === "video" && !endpointRulesForm.useOfficial;
        const preparedInstances = prepareSingleModelInstancesForSave({
          instances: [
            {
              instanceId: presetCanonicalId,
              canonicalId: presetCanonicalId,
              displayName: resolveDefaultInterfaceListName({
                preset: selectedPreset,
                t,
              }),
              modality: selectedPreset.category as
                | "text"
                | "image"
                | "video"
                | "audio",
              upstreamModelId: selectedModel.trim(),
              enabled: true,
            },
          ],
          sharedFormatTransform,
          capabilityLimitsByInstanceId,
          applyCustomVideoRules,
        });

        await createOrganizationAiInterface(organizationId, {
          provider: "custom",
          name: name.trim(),
          apiKey: apiKey.trim(),
          baseUrl,
          selectedModel: selectedModel.trim(),
          metadata: buildSingleModelProviderMetadata({
            singleModelPresetId: selectedPreset.id,
            singleModelCategory: selectedPreset.category,
            models: buildMetadataModelsFromInstances(
              preparedInstances,
              applyCustomVideoRules
            ),
            endpointRules,
          }),
          enabled: true,
          isDefault: true,
        });
        created = true;
      }

      if (!created) {
        appToast.error("pages.aiInterfaces.saveFailed");
        return;
      }

      appToast.success("pages.aiInterfaces.created");
      await onComplete();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 1) {
    return (
      <>
        <SingleModelPickerStep
          organizationId={organizationId}
          selection={selection}
          onSelectionChange={setSelection}
        />
        <WizardFooter
          showBack
          onBack={onBackFromFirstStep}
          onCancel={onCancel}
          onNext={() => onStepChange(2)}
          nextDisabled={!canProceedStep1}
        />
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <p className="text-muted-foreground text-sm">
          {t("pages.aiInterfaces.singleModel.step2Description")}
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="single-model-endpoint">
              {t("pages.aiInterfaces.singleModel.endpointUrl")}
            </Label>
            <CredentialPlainInput
              id="single-model-endpoint"
              name="single_model_endpoint"
              type="url"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
            />
            {multiModelProviderConfig?.showEndpointRegionHints ? (
              <KimiEndpointRegionHints />
            ) : null}
            {endpointRulesCategory === "video" ? (
              <SingleModelVideoEndpointUrlFields
                idPrefix="single-model"
                baseUrl={endpointUrl}
                category={endpointRulesCategory}
                useFullSubmitUrl={endpointRulesForm.useFullSubmitUrl}
                onUseFullSubmitUrlChange={(useFullSubmitUrl) =>
                  setEndpointRulesForm((current) => ({
                    ...current,
                    useFullSubmitUrl,
                  }))
                }
              />
            ) : null}
          </div>

          {multiModelProviderConfig &&
          isMultiModelProviderSelection(selection) ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="single-model-api-key">
                  {t("pages.aiInterfaces.apiKey")}
                </Label>
                <CredentialSecretInput
                  id="single-model-api-key"
                  name="single_model_api_key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="single-model-brand-name">
                  {t("pages.aiInterfaces.singleModel.interfaceListName")}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t("pages.aiInterfaces.singleModel.interfaceListNameHint")}
                </p>
                <CredentialPlainInput
                  id="single-model-brand-name"
                  name="single_model_brand_name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("pages.aiInterfaces.singleModel.selectModels")}</Label>
                <SingleModelInstanceList
                  availableModels={modelPoolOptions}
                  instances={modelInstances}
                  onChange={setModelInstances}
                  modelColumnLabel={t(
                    "pages.aiInterfaces.singleModel.modelColumn"
                  )}
                  modelIdLabel={t("pages.aiInterfaces.singleModel.modelId")}
                  addModelLabel={t("pages.aiInterfaces.singleModel.addModel")}
                  showCapabilitySettings={isVideoCategory}
                  onOpenCapabilitySettings={setCapabilitySettingsInstanceId}
                  capabilitySettingsLabel={capabilitySettingsLabel}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="single-model-api-key">
                  {t("pages.aiInterfaces.apiKey")}
                </Label>
                <CredentialSecretInput
                  id="single-model-api-key"
                  name="single_model_api_key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="single-model-id">
                  {t("pages.aiInterfaces.singleModel.modelId")}
                </Label>
                <div className="flex items-center gap-2">
                  <CredentialPlainInput
                    id="single-model-id"
                    name="single_model_id"
                    className="min-w-0 flex-1"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                  />
                  {isVideoCategory && singlePresetVideoCanonicalId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0"
                      onClick={() =>
                        setCapabilitySettingsInstanceId(
                          singlePresetVideoCanonicalId
                        )
                      }
                      aria-label={capabilitySettingsLabel}
                    >
                      <Settings className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {selectedPreset ? (
                <div className="space-y-2">
                  <Label htmlFor="single-model-name">
                    {t("pages.aiInterfaces.singleModel.interfaceListName")}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {t("pages.aiInterfaces.singleModel.interfaceListNameHint")}
                  </p>
                  <CredentialPlainInput
                    id="single-model-name"
                    name="single_model_interface_name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          )}

          {endpointRulesCategory !== "storage" ? (
            <SingleModelEndpointRulesFields
              category={endpointRulesCategory}
              value={endpointRulesForm}
              onChange={setEndpointRulesForm}
              idPrefix="single-model"
              sharedFormatTransform={sharedFormatTransform}
              onSharedFormatTransformChange={setSharedFormatTransform}
              formatTemplates={formatTemplates}
              isFormatTemplatesLoading={
                isFormatTemplatesLoading || isBaselinesLoading
              }
            />
          ) : null}
        </div>
        <WizardFooter
          showBack
          onBack={() => onStepChange(1)}
          onCancel={onCancel}
          onSave={handleSave}
          saveDisabled={!canProceedStep2 || isSaving}
          isSaving={isSaving}
        />

        <CapabilityLimitsSettingsDialog
          open={capabilitySettingsInstanceId !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setCapabilitySettingsInstanceId(null);
            }
          }}
          modelLabel={capabilitySettingsModelLabel}
          platformBaseline={capabilitySettingsBaseline}
          value={
            capabilitySettingsInstanceId
              ? (capabilityLimitsByInstanceId[capabilitySettingsInstanceId] ??
                null)
              : null
          }
          onChange={(limits) => {
            if (!capabilitySettingsInstanceId) {
              return;
            }
            setCapabilityLimitsByInstanceId((current) => ({
              ...current,
              [capabilitySettingsInstanceId]: limits,
            }));
          }}
        />
      </>
    );
  }

  return null;
}

function WizardFooter({
  showBack,
  onBack,
  onCancel,
  onNext,
  onSave,
  nextDisabled,
  saveDisabled,
  isSaving,
}: {
  showBack: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext?: () => void;
  onSave?: () => void;
  nextDisabled?: boolean;
  saveDisabled?: boolean;
  isSaving?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("mt-6 flex gap-2 sm:justify-between")}>
      <div>
        {showBack ? (
          <Button variant="outline" onClick={onBack}>
            {t("common.back")}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {onNext ? (
          <Button onClick={onNext} disabled={nextDisabled}>
            {t("common.next")}
          </Button>
        ) : null}
        {onSave ? (
          <Button onClick={() => void onSave()} disabled={saveDisabled}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
