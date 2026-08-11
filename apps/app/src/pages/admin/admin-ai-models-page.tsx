import {
  DEFAULT_AUDIO_MODEL_PARAMETER_RULES,
  DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
  DEFAULT_TEXT_MODEL_PARAMETER_RULES,
  DEFAULT_VIDEO_GENERATION_FIELDS,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  isAudioModelParameterRules,
  isImageModelParameterRules,
  isTextModelParameterRules,
  isVideoModelParameterRules,
  normalizeAudioModelParameterRules,
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
} from "@dafthunk/types";
import type {
  AudioModelParameterRules,
  GenerationCountPolicy,
  GenerationSizePolicy,
  ImageModelParameterRules,
  PlatformAiModel,
  TextModelParameterRules,
  UpstreamParamProfileField,
  VideoModelParameterRules,
} from "@dafthunk/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { parseNonNegativeInt } from "@/components/workflow/generative-reference-metadata";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  reorderAdminPlatformAiModels,
  updateAdminPlatformAiModel,
  useAdminPlatformAiModels,
} from "@/services/admin-ai-model-service";
import { cn } from "@/utils/utils";

import {
  GenerationFeaturesEditor,
  ImageCountEditor,
  SizePolicyEditor,
  VideoDurationEditor,
  useGenerationOptionLabels,
} from "./admin-generation-field-editors";
import {
  ADMIN_PARAM_HINT_CLASS,
  AdminModelBasicFields,
  AdminModelList,
  MbField,
  ModelSettingsDialogShell,
  NumberField,
  SettingsSection,
  useAdminParamApiNameAddon,
} from "./admin-ai-models-ui";
import { DEFAULT_BRAND_ICON } from "@/components/model-brand-icon-picker";
const BYTES_PER_MB = 1024 * 1024;

type AdminModelModality = "text" | "image" | "video" | "audio";

function ensureVideoGenerationFieldsForSave(
  fields: readonly UpstreamParamProfileField[]
): UpstreamParamProfileField[] {
  const withoutCount = fields.filter((field) => field.name !== "generate_count");
  if (withoutCount.some((field) => field.name === "duration")) {
    return withoutCount.map((field) => ({ ...field }));
  }
  const durationTemplate = DEFAULT_VIDEO_GENERATION_FIELDS.find(
    (field) => field.name === "duration"
  );
  if (!durationTemplate) {
    return withoutCount.map((field) => ({ ...field }));
  }
  return [...withoutCount.map((field) => ({ ...field })), { ...durationTemplate }];
}

function bytesToMbInput(bytes: number): string {
  const mb = bytes / BYTES_PER_MB;
  return String(Math.round(mb * 100) / 100);
}

function mbInputToBytes(mb: string, fallbackBytes: number): number {
  const value = Number(mb);
  if (!Number.isFinite(value) || value <= 0) {
    return fallbackBytes;
  }
  return Math.round(value * BYTES_PER_MB);
}

export function AdminAiModelsPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const [modality, setModality] = useState<AdminModelModality>("text");
  const { models, isLoading, refreshModels } = useAdminPlatformAiModels(modality);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reorderingModels, setReorderingModels] = useState(false);
  const [settingsModel, setSettingsModel] = useState<PlatformAiModel | null>(
    null
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("pages.adminAiModels.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleToggle = async (model: PlatformAiModel, enabled: boolean) => {
    setSavingId(model.canonicalId);
    try {
      await updateAdminPlatformAiModel(model.canonicalId, {
        platformEnabled: enabled,
      });
      await refreshModels();
      toast.success(t("pages.adminAiModels.saved"));
    } catch {
      toast.error(t("pages.adminAiModels.saveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveModel = async (
    model: PlatformAiModel,
    patch: {
      readonly displayName?: string;
      readonly rules:
        | TextModelParameterRules
        | ImageModelParameterRules
        | VideoModelParameterRules
        | AudioModelParameterRules;
      readonly brandIcon: string;
      readonly description: string;
    }
  ) => {
    setSavingId(model.canonicalId);
    try {
      await updateAdminPlatformAiModel(model.canonicalId, {
        ...(patch.displayName !== undefined
          ? { displayName: patch.displayName }
          : {}),
        parameterRules: patch.rules,
        brandIcon: patch.brandIcon,
        description: patch.description,
      });
      await refreshModels();
      toast.success(t("pages.adminAiModels.saved"));
      setSettingsModel(null);
    } catch {
      toast.error(t("pages.adminAiModels.saveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleReorderModels = async (orderedIds: readonly string[]) => {
    setReorderingModels(true);
    try {
      await reorderAdminPlatformAiModels([...orderedIds], modality);
      await refreshModels();
      toast.success(t("pages.adminAiModels.reorderSaved"));
    } catch {
      toast.error(t("pages.adminAiModels.reorderFailed"));
      await refreshModels();
    } finally {
      setReorderingModels(false);
    }
  };

  const textTabDescription = t("pages.adminAiModels.description");
  const imageTabDescription = t("pages.adminAiModels.imageDescription");
  const videoTabDescription = t("pages.adminAiModels.videoDescription");
  const audioTabDescription = t("pages.adminAiModels.audioDescription");

  const renderModelPanel = (emptyLabel: string, description: string) => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{description}</p>
      <AdminModelList
        models={models}
        emptyLabel={emptyLabel}
        isLoading={isLoading}
        savingId={savingId}
        reordering={reorderingModels}
        onToggle={handleToggle}
        onOpenSettings={setSettingsModel}
        onReorderModels={handleReorderModels}
      />
    </div>
  );

  return (
    <InsetLayout title={t("pages.adminAiModels.title")}>
      <Tabs
        value={modality}
        onValueChange={(value) => setModality(value as AdminModelModality)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="text">
            {t("pages.adminAiModels.textModels")}
          </TabsTrigger>
          <TabsTrigger value="image">
            {t("pages.adminAiModels.imageModels")}
          </TabsTrigger>
          <TabsTrigger value="video">
            {t("pages.adminAiModels.videoModels")}
          </TabsTrigger>
          <TabsTrigger value="audio">
            {t("pages.adminAiModels.audioModels")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-0">
          {renderModelPanel(t("pages.adminAiModels.empty"), textTabDescription)}
        </TabsContent>
        <TabsContent value="image" className="mt-0">
          {renderModelPanel(
            t("pages.adminAiModels.imageEmpty"),
            imageTabDescription
          )}
        </TabsContent>
        <TabsContent value="video" className="mt-0">
          {renderModelPanel(
            t("pages.adminAiModels.videoEmpty"),
            videoTabDescription
          )}
        </TabsContent>
        <TabsContent value="audio" className="mt-0">
          {renderModelPanel(
            t("pages.adminAiModels.audioEmpty"),
            audioTabDescription
          )}
        </TabsContent>
      </Tabs>

      {settingsModel && settingsModel.modality === "text" ? (
        <TextModelSettingsDialog
          model={settingsModel}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
      {settingsModel && settingsModel.modality === "image" ? (
        <ImageModelSettingsDialog
          model={settingsModel}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
      {settingsModel && settingsModel.modality === "video" ? (
        <VideoModelSettingsDialog
          model={settingsModel}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
      {settingsModel && settingsModel.modality === "audio" ? (
        <AudioModelSettingsDialog
          model={settingsModel}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
    </InsetLayout>
  );
}

function TextModelSettingsDialog({
  model,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: TextModelParameterRules;
    readonly brandIcon: string;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const baseRules = isTextModelParameterRules(model.parameterRules)
    ? normalizeTextModelParameterRules(model.parameterRules)
    : DEFAULT_TEXT_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [brandIcon, setBrandIcon] = useState(
    model.brandIcon ?? DEFAULT_BRAND_ICON
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [keywordsMaxChars, setKeywordsMaxChars] = useState(
    String(baseRules.keywordsMaxChars)
  );
  const [outputMaxTokens, setOutputMaxTokens] = useState(
    String(baseRules.outputMaxTokens)
  );
  const [outputMaxTokensLimit, setOutputMaxTokensLimit] = useState(
    String(baseRules.outputMaxTokensLimit)
  );
  const [outputMaxChars, setOutputMaxChars] = useState(
    String(baseRules.outputMaxChars)
  );
  const [contextWindowTokens, setContextWindowTokens] = useState(
    String(baseRules.contextWindowTokens)
  );
  const [maxTextReferences, setMaxTextReferences] = useState(
    String(baseRules.maxTextReferences)
  );
  const [maxTextReferenceChars, setMaxTextReferenceChars] = useState(
    String(baseRules.maxTextReferenceChars)
  );
  const [maxImageReferences, setMaxImageReferences] = useState(
    String(baseRules.maxImageReferences)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxImageReferenceBytes)
  );
  const [maxVideoReferences, setMaxVideoReferences] = useState(
    String(baseRules.maxVideoReferences)
  );
  const [maxVideoReferenceBytes, setMaxVideoReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxVideoReferenceBytes)
  );
  const [maxVideoReferenceSeconds, setMaxVideoReferenceSeconds] = useState(
    String(baseRules.maxVideoReferenceSeconds)
  );

  const handleSave = () => {
    const nextText = Number(maxTextReferences) || 0;
    const nextImage = Number(maxImageReferences) || 0;
    const nextVideo = Number(maxVideoReferences) || 0;
    const totalRefs = Math.max(1, nextText + nextImage + nextVideo);

    onSave({
      displayName: displayName.trim() || model.displayName,
      brandIcon,
      description: model.description ?? "",
      rules: {
        ...baseRules,
        promptMaxChars:
          Number(promptMaxChars) || baseRules.promptMaxChars,
        keywordsMaxChars:
          Number(keywordsMaxChars) || baseRules.keywordsMaxChars,
        outputMaxTokens:
          Number(outputMaxTokens) || baseRules.outputMaxTokens,
        outputMaxTokensLimit:
          Number(outputMaxTokensLimit) || baseRules.outputMaxTokensLimit,
        outputMaxChars: Math.min(
          Number(outputMaxChars) || baseRules.outputMaxChars,
          32_000
        ),
        contextWindowTokens:
          Number(contextWindowTokens) || baseRules.contextWindowTokens,
        maxTextReferences: nextText,
        maxTextReferenceChars:
          Number(maxTextReferenceChars) || baseRules.maxTextReferenceChars,
        maxImageReferences: nextImage,
        maxImageReferenceBytes: mbInputToBytes(
          maxImageReferenceBytes,
          baseRules.maxImageReferenceBytes
        ),
        maxVideoReferences: nextVideo,
        maxVideoReferenceBytes: mbInputToBytes(
          maxVideoReferenceBytes,
          baseRules.maxVideoReferenceBytes
        ),
        maxVideoReferenceSeconds:
          Number(maxVideoReferenceSeconds) ||
          baseRules.maxVideoReferenceSeconds,
        referenceInputs: [
          {
            type: "any",
            field: "keywords",
            maxCount: totalRefs,
          },
        ],
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      dialogWidth="800"
      title={t("pages.adminAiModels.settingsTitle", {
        name: model.displayName,
      })}
      description={t("pages.adminAiModels.settingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionBasic")}
      >
        <AdminModelBasicFields
          canonicalId={model.canonicalId}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          brandIcon={brandIcon}
          onBrandIconChange={setBrandIcon}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionPrompt")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.promptMaxChars")}
          value={promptMaxChars}
          onChange={setPromptMaxChars}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.keywordsMaxChars")}
          value={keywordsMaxChars}
          onChange={setKeywordsMaxChars}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionOutput")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.outputMaxTokens")}
          value={outputMaxTokens}
          onChange={setOutputMaxTokens}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.outputMaxTokensLimit")}
          value={outputMaxTokensLimit}
          onChange={setOutputMaxTokensLimit}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.outputMaxChars")}
          value={outputMaxChars}
          onChange={(value) => {
            const next = Number(value);
            if (Number.isFinite(next) && next > 32_000) {
              setOutputMaxChars("32000");
              return;
            }
            setOutputMaxChars(value);
          }}
        />
        <p className={cn("col-span-full", ADMIN_PARAM_HINT_CLASS)}>
          {t("pages.adminAiModels.outputMaxCharsHint")}
        </p>
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.contextWindowTokens")}
          value={contextWindowTokens}
          onChange={setContextWindowTokens}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionReferences")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxTextReferences")}
          value={maxTextReferences}
          onChange={setMaxTextReferences}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxTextReferenceChars")}
          value={maxTextReferenceChars}
          onChange={setMaxTextReferenceChars}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferences")}
          value={maxImageReferences}
          onChange={setMaxImageReferences}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferenceBytes")}
          value={maxImageReferenceBytes}
          onChange={setMaxImageReferenceBytes}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxVideoReferences")}
          value={maxVideoReferences}
          onChange={setMaxVideoReferences}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxVideoReferenceBytes")}
          value={maxVideoReferenceBytes}
          onChange={setMaxVideoReferenceBytes}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxVideoReferenceSeconds")}
          value={maxVideoReferenceSeconds}
          onChange={setMaxVideoReferenceSeconds}
        />
      </SettingsSection>
    </ModelSettingsDialogShell>
  );
}

function ImageModelSettingsDialog({
  model,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: ImageModelParameterRules;
    readonly brandIcon: string;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();
  const baseRules = isImageModelParameterRules(model.parameterRules)
    ? normalizeImageModelParameterRules(model.parameterRules)
    : DEFAULT_IMAGE_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [brandIcon, setBrandIcon] = useState(
    model.brandIcon ?? DEFAULT_BRAND_ICON
  );
  const [maxReferenceImages, setMaxReferenceImages] = useState(
    String(baseRules.maxReferenceImages)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxImageReferenceBytes)
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [sizePolicy, setSizePolicy] = useState<GenerationSizePolicy>(
    baseRules.sizePolicy ?? { enabled: false, effectMode: "legacy" }
  );
  const [countPolicy, setCountPolicy] = useState<GenerationCountPolicy>(
    baseRules.countPolicy ?? {
      enabled: false,
      effectMode: "sequential_image_generation",
    }
  );
  const [generationFields, setGenerationFields] = useState<
    UpstreamParamProfileField[]
  >(baseRules.generationFields.map((field) => ({ ...field })));

  const sizeFieldApiName =
    generationFields.find((field) => field.name === "size")?.apiName ?? "size";
  const sizeApiNameHeader = useAdminParamApiNameAddon(
    sizeFieldApiName,
    (next) => {
      setGenerationFields((fields) =>
        fields.map((field) =>
          field.name === "size" ? { ...field, apiName: next } : field
        )
      );
    }
  );

  const countFieldApiName =
    generationFields.find((field) => field.name === "generate_count")
      ?.apiName ?? "max_images";
  const countApiNameHeader = useAdminParamApiNameAddon(
    countFieldApiName,
    (next) => {
      setGenerationFields((fields) =>
        fields.map((field) =>
          field.name === "generate_count"
            ? { ...field, apiName: next }
            : field
        )
      );
    }
  );

  const handleSave = () => {
    onSave({
      displayName: displayName.trim() || model.displayName,
      brandIcon,
      description: model.description ?? "",
      rules: {
        ...baseRules,
        sizePolicy,
        countPolicy,
        maxReferenceImages: parseNonNegativeInt(
          maxReferenceImages,
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxReferenceImages
        ),
        maxImageReferenceBytes: mbInputToBytes(
          maxImageReferenceBytes,
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxImageReferenceBytes
        ),
        promptMaxChars:
          Number(promptMaxChars) ||
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.promptMaxChars,
        generationFields,
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      dialogWidth="800"
      title={t("pages.adminAiModels.settingsTitle", { name: model.displayName })}
      description={t("pages.adminAiModels.imageSettingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionBasic")}
      >
        <AdminModelBasicFields
          canonicalId={model.canonicalId}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          brandIcon={brandIcon}
          onBrandIconChange={setBrandIcon}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionReferences")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.promptMaxChars")}
          value={promptMaxChars}
          onChange={setPromptMaxChars}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferences")}
          value={maxReferenceImages}
          onChange={setMaxReferenceImages}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferenceBytes")}
          value={maxImageReferenceBytes}
          onChange={setMaxImageReferenceBytes}
        />
      </SettingsSection>

      <SettingsSection
        compact
        stacked
        title={t("pages.adminAiModels.sizePolicyLabel")}
        titleAddon={sizeApiNameHeader.titleAddon}
        action={
          <Switch
            checked={sizePolicy.enabled}
            onCheckedChange={(enabled) =>
              setSizePolicy({ ...sizePolicy, enabled })
            }
          />
        }
      >
        <SizePolicyEditor
          policy={sizePolicy}
          fields={generationFields}
          optionLabels={optionLabels}
          onChange={setSizePolicy}
          onFieldsChange={setGenerationFields}
        />
      </SettingsSection>

      <SettingsSection
        compact
        stacked
        title={t("pages.adminAiModels.imageCountLabel")}
        titleAddon={countApiNameHeader.titleAddon}
        action={
          <Switch
            checked={countPolicy.enabled}
            onCheckedChange={(enabled) =>
              setCountPolicy({ ...countPolicy, enabled })
            }
          />
        }
      >
        <ImageCountEditor
          policy={countPolicy}
          fields={generationFields}
          onPolicyChange={setCountPolicy}
          onFieldsChange={setGenerationFields}
        />
      </SettingsSection>

      <GenerationFeaturesEditor
        fields={generationFields}
        modality="image"
        layout="flat"
        optionLabels={optionLabels}
        onChange={setGenerationFields}
      />
    </ModelSettingsDialogShell>
  );
}

function VideoModelSettingsDialog({
  model,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: VideoModelParameterRules;
    readonly brandIcon: string;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();
  const baseRules = isVideoModelParameterRules(model.parameterRules)
    ? normalizeVideoModelParameterRules(model.parameterRules)
    : DEFAULT_VIDEO_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [brandIcon, setBrandIcon] = useState(
    model.brandIcon ?? DEFAULT_BRAND_ICON
  );
  const [maxReferenceImages, setMaxReferenceImages] = useState(
    String(baseRules.maxReferenceImages)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxImageReferenceBytes)
  );
  const [maxReferenceVideos, setMaxReferenceVideos] = useState(
    String(baseRules.maxReferenceVideos)
  );
  const [maxVideoReferenceBytes, setMaxVideoReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxVideoReferenceBytes)
  );
  const [maxVideoReferenceSeconds, setMaxVideoReferenceSeconds] = useState(
    String(baseRules.maxVideoReferenceSeconds)
  );
  const [maxReferenceAudios, setMaxReferenceAudios] = useState(
    String(baseRules.maxReferenceAudios)
  );
  const [maxAudioReferenceBytes, setMaxAudioReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxAudioReferenceBytes)
  );
  const [maxAudioReferenceSeconds, setMaxAudioReferenceSeconds] = useState(
    String(baseRules.maxAudioReferenceSeconds)
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [generationFields, setGenerationFields] = useState<
    UpstreamParamProfileField[]
  >(baseRules.generationFields.map((field) => ({ ...field })));
  const durationApiName =
    generationFields.find((field) => field.name === "duration")?.apiName ??
    "duration";
  const durationApiNameHeader = useAdminParamApiNameAddon(
    durationApiName,
    (next) => {
      setGenerationFields((fields) =>
        fields.map((field) =>
          field.name === "duration" ? { ...field, apiName: next } : field
        )
      );
    }
  );

  const handleSave = () => {
    onSave({
      displayName: displayName.trim() || model.displayName,
      brandIcon,
      description: model.description ?? "",
      rules: {
        ...baseRules,
        maxReferenceImages: parseNonNegativeInt(
          maxReferenceImages,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceImages
        ),
        maxImageReferenceBytes: mbInputToBytes(
          maxImageReferenceBytes,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxImageReferenceBytes
        ),
        maxReferenceVideos: parseNonNegativeInt(
          maxReferenceVideos,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos
        ),
        maxVideoReferenceBytes: mbInputToBytes(
          maxVideoReferenceBytes,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes
        ),
        maxVideoReferenceSeconds:
          Number(maxVideoReferenceSeconds) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
        maxReferenceAudios: parseNonNegativeInt(
          maxReferenceAudios,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceAudios
        ),
        maxAudioReferenceBytes: mbInputToBytes(
          maxAudioReferenceBytes,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxAudioReferenceBytes
        ),
        maxAudioReferenceSeconds:
          Number(maxAudioReferenceSeconds) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxAudioReferenceSeconds,
        promptMaxChars:
          Number(promptMaxChars) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.promptMaxChars,
        generationFields: ensureVideoGenerationFieldsForSave(generationFields),
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      dialogWidth="800"
      title={t("pages.adminAiModels.settingsTitle", { name: model.displayName })}
      description={t("pages.adminAiModels.videoSettingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionBasic")}
      >
        <AdminModelBasicFields
          canonicalId={model.canonicalId}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          brandIcon={brandIcon}
          onBrandIconChange={setBrandIcon}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionReferences")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.promptMaxChars")}
          value={promptMaxChars}
          onChange={setPromptMaxChars}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferences")}
          value={maxReferenceImages}
          onChange={setMaxReferenceImages}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferenceBytes")}
          value={maxImageReferenceBytes}
          onChange={setMaxImageReferenceBytes}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxVideoReferences")}
          value={maxReferenceVideos}
          onChange={setMaxReferenceVideos}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxVideoReferenceBytes")}
          value={maxVideoReferenceBytes}
          onChange={setMaxVideoReferenceBytes}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxVideoReferenceSeconds")}
          value={maxVideoReferenceSeconds}
          onChange={setMaxVideoReferenceSeconds}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxAudioReferences")}
          value={maxReferenceAudios}
          onChange={setMaxReferenceAudios}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxAudioReferenceBytes")}
          value={maxAudioReferenceBytes}
          onChange={setMaxAudioReferenceBytes}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxAudioReferenceSeconds")}
          value={maxAudioReferenceSeconds}
          onChange={setMaxAudioReferenceSeconds}
        />
      </SettingsSection>

      <SettingsSection
        compact
        stacked
        title={t("pages.adminAiModels.videoDurationLabel")}
        titleAddon={durationApiNameHeader.titleAddon}
      >
        <VideoDurationEditor
          fields={generationFields}
          onFieldsChange={setGenerationFields}
        />
      </SettingsSection>

      <GenerationFeaturesEditor
        fields={generationFields}
        modality="video"
        layout="flat"
        optionLabels={optionLabels}
        onChange={setGenerationFields}
      />
    </ModelSettingsDialogShell>
  );
}

function AudioModelSettingsDialog({
  model,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: AudioModelParameterRules;
    readonly brandIcon: string;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();
  const baseRules = isAudioModelParameterRules(model.parameterRules)
    ? normalizeAudioModelParameterRules(model.parameterRules)
    : DEFAULT_AUDIO_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [brandIcon, setBrandIcon] = useState(
    model.brandIcon ?? DEFAULT_BRAND_ICON
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [generationFields, setGenerationFields] = useState<
    UpstreamParamProfileField[]
  >(baseRules.generationFields.map((field) => ({ ...field })));

  const handleSave = () => {
    onSave({
      displayName: displayName.trim() || model.displayName,
      brandIcon,
      description: model.description ?? "",
      rules: {
        ...baseRules,
        promptMaxChars:
          Number(promptMaxChars) ||
          DEFAULT_AUDIO_MODEL_PARAMETER_RULES.promptMaxChars,
        generationFields,
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      dialogWidth="800"
      title={t("pages.adminAiModels.settingsTitle", { name: model.displayName })}
      description={t("pages.adminAiModels.audioSettingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionBasic")}
      >
        <AdminModelBasicFields
          canonicalId={model.canonicalId}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          brandIcon={brandIcon}
          onBrandIconChange={setBrandIcon}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionPrompt")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.promptMaxChars")}
          value={promptMaxChars}
          onChange={setPromptMaxChars}
        />
      </SettingsSection>

      <GenerationFeaturesEditor
        fields={generationFields}
        modality="audio"
        layout="flat"
        optionLabels={optionLabels}
        onChange={setGenerationFields}
      />
    </ModelSettingsDialogShell>
  );
}
