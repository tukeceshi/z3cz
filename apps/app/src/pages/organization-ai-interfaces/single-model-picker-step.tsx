import type {
  SingleModelPresetCategory,
  SingleModelPresetEntry,
  SingleModelWizardSelection,
} from "@dafthunk/types";
import {
  CLAUDE_CANONICAL_IDS,
  CLAUDE_PROVIDER_CARD_ID,
  createDefaultClaudeSelection,
  createDefaultDeepSeekSelection,
  createDefaultGeminiSelection,
  createDefaultGrokImagineImageSelection,
  createDefaultGrokImagineVideoSelection,
  createDefaultGrokSelection,
  createDefaultGlmSelection,
  createDefaultKimiSelection,
  createDefaultMinimaxSpeechSelection,
  createDefaultNanoBananaSelection,
  createDefaultOpenAiImageSelection,
  createDefaultOpenAiSelection,
  createDefaultSeedanceSelection,
  createDefaultSeedreamSelection,
  createDefaultSeedSelection,
  createDefaultVeoSelection,
  DEEPSEEK_CANONICAL_IDS,
  DEEPSEEK_PROVIDER_CARD_ID,
  GLM_CANONICAL_IDS,
  GLM_PROVIDER_CARD_ID,
  GEMINI_CANONICAL_IDS,
  GEMINI_PROVIDER_CARD_ID,
  GROK_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_CANONICAL_IDS,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  KIMI_CANONICAL_IDS,
  KIMI_PROVIDER_CARD_ID,
  MINIMAX_SPEECH_CANONICAL_IDS,
  MINIMAX_SPEECH_PROVIDER_CARD_ID,
  NANO_BANANA_CANONICAL_IDS,
  NANO_BANANA_PROVIDER_CARD_ID,
  OPENAI_CANONICAL_IDS,
  OPENAI_IMAGE_CANONICAL_IDS,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  SEEDANCE_CANONICAL_IDS,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_CANONICAL_IDS,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_CANONICAL_IDS,
  SEEDREAM_PROVIDER_CARD_ID,
  VEO_CANONICAL_IDS,
  VEO_PROVIDER_CARD_ID,
  getSingleModelPresetById,
  getSingleModelPresetsByCategory,
  SINGLE_MODEL_PRESET_CATEGORIES,
} from "@dafthunk/types";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import {
  useOrgAudioModels,
  useOrgImageModels,
  useOrgTextModels,
  useOrgVideoModels,
} from "@/services/platform-ai-model-service";
import { cn } from "@/utils/utils";

import { ModelBrandIcon } from "./model-brand-icon";
import { resolveSingleModelPresetCardName } from "./single-model-display-name";

type SingleModelPickerFilter = "all" | SingleModelPresetCategory;

const PICKER_FILTERS: readonly SingleModelPickerFilter[] = [
  "all",
  ...SINGLE_MODEL_PRESET_CATEGORIES,
];

const FILTER_TITLE_KEYS: Record<SingleModelPickerFilter, TranslationKey> = {
  all: "pages.aiInterfaces.singleModel.categories.all",
  text: "pages.aiInterfaces.singleModel.categories.text",
  image: "pages.aiInterfaces.singleModel.categories.image",
  video: "pages.aiInterfaces.singleModel.categories.video",
  audio: "pages.aiInterfaces.singleModel.categories.audio",
  storage: "pages.aiInterfaces.singleModel.categories.storage",
};

function matchesTextFilter(filter: SingleModelPickerFilter): boolean {
  return filter === "all" || filter === "text";
}

function matchesImageFilter(filter: SingleModelPickerFilter): boolean {
  return filter === "all" || filter === "image";
}

function matchesVideoFilter(filter: SingleModelPickerFilter): boolean {
  return filter === "all" || filter === "video";
}

function matchesAudioFilter(filter: SingleModelPickerFilter): boolean {
  return filter === "all" || filter === "audio";
}

function resolveInitialPickerFilter(
  selection: SingleModelWizardSelection,
  selectedPreset?: SingleModelPresetEntry
): SingleModelPickerFilter {
  if (selectedPreset) {
    return selectedPreset.category;
  }
  if (selection.kind === "deepseek" || selection.kind === "seed" || selection.kind === "glm" || selection.kind === "kimi" || selection.kind === "openai" || selection.kind === "gemini" || selection.kind === "grok" || selection.kind === "claude") {
    return "text";
  }
  if (selection.kind === "seedance" || selection.kind === "veo" || selection.kind === "grok-imagine-video") {
    return "video";
  }
  if (selection.kind === "minimax-speech") {
    return "audio";
  }
  if (selection.kind === "seedream") {
    return "image";
  }
  if (selection.kind === "openai-image") {
    return "image";
  }
  if (selection.kind === "nano-banana" || selection.kind === "grok-imagine-image") {
    return "image";
  }
  return "all";
}

function FilterTab({
  filter,
  selected,
  onSelect,
}: {
  filter: SingleModelPickerFilter;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {t(FILTER_TITLE_KEYS[filter])}
    </button>
  );
}

function PresetTile({
  label,
  selected,
  onSelect,
  canonicalId,
  presetId,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  canonicalId?: string;
  presetId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
        "hover:border-primary/50 hover:bg-muted/40",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card"
      )}
    >
      <ModelBrandIcon canonicalId={canonicalId} presetId={presetId} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
    </button>
  );
}

interface SingleModelPickerStepProps {
  organizationId: string;
  selection: SingleModelWizardSelection;
  onSelectionChange: (selection: SingleModelWizardSelection) => void;
}

export function SingleModelPickerStep({
  organizationId,
  selection,
  onSelectionChange,
}: SingleModelPickerStepProps) {
  const { t } = useTranslation();
  const grouped = getSingleModelPresetsByCategory();
  const { models: textModels } = useOrgTextModels(organizationId);
  const { models: imageModels } = useOrgImageModels(organizationId);
  const { models: videoModels } = useOrgVideoModels(organizationId);
  const { models: audioModels } = useOrgAudioModels(organizationId);

  const selectedPreset =
    selection.kind === "preset"
      ? getSingleModelPresetById(selection.presetId)
      : undefined;

  const [activeFilter, setActiveFilter] = useState<SingleModelPickerFilter>(() =>
    resolveInitialPickerFilter(selection, selectedPreset)
  );

  const enabledCanonicalIds = useMemo(() => {
    const models =
      activeFilter === "all"
        ? [...textModels, ...imageModels, ...videoModels, ...audioModels]
        : activeFilter === "text"
          ? textModels
          : activeFilter === "image"
            ? imageModels
            : activeFilter === "video"
              ? videoModels
              : activeFilter === "audio"
                ? audioModels
                : [];
    return new Set(models.map((model) => model.canonicalId));
  }, [activeFilter, audioModels, imageModels, textModels, videoModels]);

  const showDeepSeekCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (DEEPSEEK_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const deepSeekEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (DEEPSEEK_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showSeedCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (SEED_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const seedEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (SEED_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showGlmCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (GLM_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const glmEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (GLM_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showKimiCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (KIMI_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const kimiEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (KIMI_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showOpenAiCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (OPENAI_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const openAiEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (OPENAI_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showGeminiCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (GEMINI_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const geminiEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (GEMINI_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showSeedanceCard = useMemo(() => {
    if (!matchesVideoFilter(activeFilter)) {
      return false;
    }
    return videoModels.some((model) =>
      (SEEDANCE_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, videoModels]);

  const seedanceEnabledIds = useMemo(
    () =>
      videoModels
        .filter((model) =>
          (SEEDANCE_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [videoModels]
  );

  const showSeedreamCard = useMemo(() => {
    if (!matchesImageFilter(activeFilter)) {
      return false;
    }
    return imageModels.some((model) =>
      (SEEDREAM_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, imageModels]);

  const seedreamEnabledIds = useMemo(
    () =>
      imageModels
        .filter((model) =>
          (SEEDREAM_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [imageModels]
  );

  const showOpenAiImageCard = useMemo(() => {
    if (!matchesImageFilter(activeFilter)) {
      return false;
    }
    return imageModels.some((model) =>
      (OPENAI_IMAGE_CANONICAL_IDS as readonly string[]).includes(
        model.canonicalId
      )
    );
  }, [activeFilter, imageModels]);

  const openAiImageEnabledIds = useMemo(
    () =>
      imageModels
        .filter((model) =>
          (OPENAI_IMAGE_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [imageModels]
  );

  const showNanoBananaCard = useMemo(() => {
    if (!matchesImageFilter(activeFilter)) {
      return false;
    }
    return imageModels.some((model) =>
      (NANO_BANANA_CANONICAL_IDS as readonly string[]).includes(
        model.canonicalId
      )
    );
  }, [activeFilter, imageModels]);

  const nanoBananaEnabledIds = useMemo(
    () =>
      imageModels
        .filter((model) =>
          (NANO_BANANA_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [imageModels]
  );

  const showVeoCard = useMemo(() => {
    if (!matchesVideoFilter(activeFilter)) {
      return false;
    }
    return videoModels.some((model) =>
      (VEO_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, videoModels]);

  const veoEnabledIds = useMemo(
    () =>
      videoModels
        .filter((model) =>
          (VEO_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [videoModels]
  );

  const showGrokCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (GROK_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const grokEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (GROK_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showClaudeCard = useMemo(() => {
    if (!matchesTextFilter(activeFilter)) {
      return false;
    }
    return textModels.some((model) =>
      (CLAUDE_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
    );
  }, [activeFilter, textModels]);

  const claudeEnabledIds = useMemo(
    () =>
      textModels
        .filter((model) =>
          (CLAUDE_CANONICAL_IDS as readonly string[]).includes(model.canonicalId)
        )
        .map((model) => model.canonicalId),
    [textModels]
  );

  const showGrokImagineImageCard = useMemo(() => {
    if (!matchesImageFilter(activeFilter)) {
      return false;
    }
    return imageModels.some((model) =>
      (GROK_IMAGINE_IMAGE_CANONICAL_IDS as readonly string[]).includes(
        model.canonicalId
      )
    );
  }, [activeFilter, imageModels]);

  const grokImagineImageEnabledIds = useMemo(
    () =>
      imageModels
        .filter((model) =>
          (GROK_IMAGINE_IMAGE_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [imageModels]
  );

  const showGrokImagineVideoCard = useMemo(() => {
    if (!matchesVideoFilter(activeFilter)) {
      return false;
    }
    return videoModels.some((model) =>
      (GROK_IMAGINE_VIDEO_CANONICAL_IDS as readonly string[]).includes(
        model.canonicalId
      )
    );
  }, [activeFilter, videoModels]);

  const grokImagineVideoEnabledIds = useMemo(
    () =>
      videoModels
        .filter((model) =>
          (GROK_IMAGINE_VIDEO_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [videoModels]
  );

  const showMinimaxSpeechCard = useMemo(() => {
    if (!matchesAudioFilter(activeFilter)) {
      return false;
    }
    return audioModels.some((model) =>
      (MINIMAX_SPEECH_CANONICAL_IDS as readonly string[]).includes(
        model.canonicalId
      )
    );
  }, [activeFilter, audioModels]);

  const minimaxSpeechEnabledIds = useMemo(
    () =>
      audioModels
        .filter((model) =>
          (MINIMAX_SPEECH_CANONICAL_IDS as readonly string[]).includes(
            model.canonicalId
          )
        )
        .map((model) => model.canonicalId),
    [audioModels]
  );

  const visiblePresets = useMemo(() => {
    const categories: SingleModelPresetCategory[] =
      activeFilter === "all"
        ? ["text", "image", "video", "audio"]
        : [activeFilter];

    const presets: SingleModelPresetEntry[] = [];
    for (const category of categories) {
      for (const preset of grouped[category]) {
        if (!preset.canonicalId || enabledCanonicalIds.has(preset.canonicalId)) {
          presets.push(preset);
        }
      }
    }
    return presets;
  }, [activeFilter, enabledCanonicalIds, grouped]);

  const handleFilterChange = (filter: SingleModelPickerFilter) => {
    setActiveFilter(filter);
    onSelectionChange({ kind: "preset", presetId: "" });
  };

  const handlePresetSelect = (presetId: string) => {
    onSelectionChange({ kind: "preset", presetId });
  };

  const handleDeepSeekSelect = () => {
    onSelectionChange(createDefaultDeepSeekSelection(deepSeekEnabledIds));
  };

  const handleSeedSelect = () => {
    onSelectionChange(createDefaultSeedSelection(seedEnabledIds));
  };

  const handleGlmSelect = () => {
    onSelectionChange(createDefaultGlmSelection(glmEnabledIds));
  };

  const handleKimiSelect = () => {
    onSelectionChange(createDefaultKimiSelection(kimiEnabledIds));
  };

  const handleOpenAiSelect = () => {
    onSelectionChange(createDefaultOpenAiSelection(openAiEnabledIds));
  };

  const handleGeminiSelect = () => {
    onSelectionChange(createDefaultGeminiSelection(geminiEnabledIds));
  };

  const handleSeedanceSelect = () => {
    onSelectionChange(createDefaultSeedanceSelection(seedanceEnabledIds));
  };

  const handleSeedreamSelect = () => {
    onSelectionChange(createDefaultSeedreamSelection(seedreamEnabledIds));
  };

  const handleOpenAiImageSelect = () => {
    onSelectionChange(createDefaultOpenAiImageSelection(openAiImageEnabledIds));
  };

  const handleNanoBananaSelect = () => {
    onSelectionChange(createDefaultNanoBananaSelection(nanoBananaEnabledIds));
  };

  const handleVeoSelect = () => {
    onSelectionChange(createDefaultVeoSelection(veoEnabledIds));
  };

  const handleGrokSelect = () => {
    onSelectionChange(createDefaultGrokSelection(grokEnabledIds));
  };

  const handleClaudeSelect = () => {
    onSelectionChange(createDefaultClaudeSelection(claudeEnabledIds));
  };

  const handleGrokImagineImageSelect = () => {
    onSelectionChange(
      createDefaultGrokImagineImageSelection(grokImagineImageEnabledIds)
    );
  };

  const handleGrokImagineVideoSelect = () => {
    onSelectionChange(
      createDefaultGrokImagineVideoSelection(grokImagineVideoEnabledIds)
    );
  };

  const handleMinimaxSpeechSelect = () => {
    onSelectionChange(
      createDefaultMinimaxSpeechSelection(minimaxSpeechEnabledIds)
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t("pages.aiInterfaces.singleModel.step1Description")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PICKER_FILTERS.map((filter) => (
          <FilterTab
            key={filter}
            filter={filter}
            selected={activeFilter === filter}
            onSelect={() => handleFilterChange(filter)}
          />
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto pr-1">
        {activeFilter === "storage" ? (
          <div className="bg-muted/40 text-muted-foreground rounded-lg border p-4 text-sm">
            <p>{t("pages.aiInterfaces.singleModel.storageTabEmpty")}</p>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {showDeepSeekCard ? (
            <PresetTile
              presetId={DEEPSEEK_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.deepseekProvider")}
              selected={selection.kind === "deepseek"}
              onSelect={handleDeepSeekSelect}
            />
          ) : null}
          {showSeedCard ? (
            <PresetTile
              presetId={SEED_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.seedProvider")}
              selected={selection.kind === "seed"}
              onSelect={handleSeedSelect}
            />
          ) : null}
          {showSeedanceCard ? (
            <PresetTile
              presetId={SEEDANCE_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.seedanceProvider")}
              selected={selection.kind === "seedance"}
              onSelect={handleSeedanceSelect}
            />
          ) : null}
          {showSeedreamCard ? (
            <PresetTile
              presetId={SEEDREAM_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.seedreamProvider")}
              selected={selection.kind === "seedream"}
              onSelect={handleSeedreamSelect}
            />
          ) : null}
          {showGlmCard ? (
            <PresetTile
              presetId={GLM_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.glmProvider")}
              selected={selection.kind === "glm"}
              onSelect={handleGlmSelect}
            />
          ) : null}
          {showKimiCard ? (
            <PresetTile
              presetId={KIMI_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.kimiProvider")}
              selected={selection.kind === "kimi"}
              onSelect={handleKimiSelect}
            />
          ) : null}
          {showOpenAiCard ? (
            <PresetTile
              presetId={OPENAI_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.openaiProvider")}
              selected={selection.kind === "openai"}
              onSelect={handleOpenAiSelect}
            />
          ) : null}
          {showOpenAiImageCard ? (
            <PresetTile
              presetId={OPENAI_IMAGE_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.openaiImageProvider")}
              selected={selection.kind === "openai-image"}
              onSelect={handleOpenAiImageSelect}
            />
          ) : null}
          {showGeminiCard ? (
            <PresetTile
              presetId={GEMINI_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.geminiProvider")}
              selected={selection.kind === "gemini"}
              onSelect={handleGeminiSelect}
            />
          ) : null}
          {showNanoBananaCard ? (
            <PresetTile
              presetId={NANO_BANANA_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.nanoBananaProvider")}
              selected={selection.kind === "nano-banana"}
              onSelect={handleNanoBananaSelect}
            />
          ) : null}
          {showVeoCard ? (
            <PresetTile
              presetId={VEO_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.veoProvider")}
              selected={selection.kind === "veo"}
              onSelect={handleVeoSelect}
            />
          ) : null}
          {showGrokCard ? (
            <PresetTile
              presetId={GROK_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.grokProvider")}
              selected={selection.kind === "grok"}
              onSelect={handleGrokSelect}
            />
          ) : null}
          {showGrokImagineImageCard ? (
            <PresetTile
              presetId={GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.grokImagineImageProvider")}
              selected={selection.kind === "grok-imagine-image"}
              onSelect={handleGrokImagineImageSelect}
            />
          ) : null}
          {showGrokImagineVideoCard ? (
            <PresetTile
              presetId={GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.grokImagineVideoProvider")}
              selected={selection.kind === "grok-imagine-video"}
              onSelect={handleGrokImagineVideoSelect}
            />
          ) : null}
          {showMinimaxSpeechCard ? (
            <PresetTile
              presetId={MINIMAX_SPEECH_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.minimaxSpeechProvider")}
              selected={selection.kind === "minimax-speech"}
              onSelect={handleMinimaxSpeechSelect}
            />
          ) : null}
          {showClaudeCard ? (
            <PresetTile
              presetId={CLAUDE_PROVIDER_CARD_ID}
              label={t("pages.aiInterfaces.singleModel.presets.claudeProvider")}
              selected={selection.kind === "claude"}
              onSelect={handleClaudeSelect}
            />
          ) : null}
          {visiblePresets.map((preset) => (
            <PresetTile
              key={preset.id}
              presetId={preset.id}
              canonicalId={preset.canonicalId}
              label={resolveSingleModelPresetCardName(preset, t)}
              selected={
                selection.kind === "preset" && selection.presetId === preset.id
              }
              onSelect={() => handlePresetSelect(preset.id)}
            />
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

export function isSingleModelSelectionValid(
  selection: SingleModelWizardSelection
): boolean {
  if (
    selection.kind === "deepseek" ||
    selection.kind === "seed" ||
    selection.kind === "glm" ||
    selection.kind === "kimi" ||
    selection.kind === "openai" ||
    selection.kind === "gemini" ||
    selection.kind === "grok" ||
    selection.kind === "claude" ||
    selection.kind === "openai-image" ||
    selection.kind === "nano-banana" ||
    selection.kind === "grok-imagine-image" ||
    selection.kind === "seedance" ||
    selection.kind === "veo" ||
    selection.kind === "grok-imagine-video" ||
    selection.kind === "minimax-speech" ||
    selection.kind === "seedream"
  ) {
    return true;
  }
  return Boolean(getSingleModelPresetById(selection.presetId));
}

export function isSingleModelStep2Valid(
  selection: SingleModelWizardSelection
): boolean {
  if (
    selection.kind === "deepseek" ||
    selection.kind === "seed" ||
    selection.kind === "glm" ||
    selection.kind === "kimi" ||
    selection.kind === "openai" ||
    selection.kind === "gemini" ||
    selection.kind === "grok" ||
    selection.kind === "claude" ||
    selection.kind === "openai-image" ||
    selection.kind === "nano-banana" ||
    selection.kind === "grok-imagine-image" ||
    selection.kind === "seedance" ||
    selection.kind === "veo" ||
    selection.kind === "grok-imagine-video" ||
    selection.kind === "minimax-speech" ||
    selection.kind === "seedream"
  ) {
    return selection.checkedCanonicalIds.length > 0;
  }
  return true;
}
