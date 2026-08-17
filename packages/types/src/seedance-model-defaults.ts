import {
  buildDurationOptions,
  PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  VIDEO_RATIO_OPTIONS,
  VIDEO_REFERENCE_MODE_OPTIONS,
  VIDEO_RESOLUTION_OPTIONS,
  type VideoModelParameterRules,
  type VideoModelPriceEstimateTier,
} from "./platform-ai-model";
import {
  isSeedanceCanonicalId,
  type SeedanceCanonicalId,
} from "./single-model-interface-metadata";
import type { UpstreamParamProfileField } from "./upstream-param-profile";

export interface SeedancePlatformModelDefault {
  readonly canonicalId: SeedanceCanonicalId;
  readonly displayName: string;
  readonly platformEnabled: boolean;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string;
  readonly parameterRules: VideoModelParameterRules;
}

function seedancePriceTier(
  resolution: string,
  enabled: boolean,
  priceWithoutVideo: number,
  priceWithVideo: number
): VideoModelPriceEstimateTier {
  return {
    resolution,
    enabled,
    priceWithoutVideo,
    priceWithVideo,
  };
}

function seedanceGenerationFields(options: {
  readonly durationMax: number;
  readonly resolutionDefault: string;
  readonly resolutionValues: readonly string[];
}): readonly UpstreamParamProfileField[] {
  return [
    {
      name: "ratio",
      apiName: "ratio",
      type: "string",
      description: "Output aspect ratio",
      default: "adaptive",
      enumValues: [...VIDEO_RATIO_OPTIONS],
    },
    {
      name: "duration",
      apiName: "duration",
      type: "number",
      description: "Video duration in seconds",
      default: 5,
      enumValues: buildDurationOptions(4, options.durationMax),
    },
    {
      name: "resolution",
      apiName: "resolution",
      type: "string",
      description: "Output resolution",
      default: options.resolutionDefault,
      enumValues: [...options.resolutionValues],
    },
    {
      name: "generate_audio",
      apiName: "generate_audio",
      type: "boolean",
      description: "Generate synchronized audio",
      default: true,
    },
    {
      name: "watermark",
      apiName: "watermark",
      type: "boolean",
      description: "Add AI-generated watermark",
      default: false,
    },
    {
      name: "reference_mode",
      apiName: "",
      type: "string",
      description: "Reference assignment mode",
      default: "reference_image",
      enumValues: [...VIDEO_REFERENCE_MODE_OPTIONS],
      clientOnly: true,
    },
    {
      name: "web_search",
      apiName: "web_search",
      type: "boolean",
      description: "Web search",
      default: false,
    },
    {
      name: "seed",
      apiName: "seed",
      type: "number",
      description: "Random seed (-1 for random)",
      default: -1,
      hidden: true,
    },
  ];
}

const SEEDANCE_2_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  sizePolicy: { enabled: false, effectMode: "legacy" },
  maxReferenceImages: 9,
  maxImageReferenceBytes: 31_457_280,
  maxReferenceVideos: 3,
  maxVideoReferenceBytes: 52_428_800,
  maxVideoReferenceSeconds: 60,
  maxReferenceAudios: 3,
  maxAudioReferenceBytes: 15_728_640,
  maxAudioReferenceSeconds: 15,
  promptMaxChars: 1000,
  supportsTaskCancel: true,
  priceEstimate: {
    enabled: true,
    tiers: [
      seedancePriceTier("480p", true, 46, 28),
      seedancePriceTier("720p", true, 46, 28),
      seedancePriceTier("1080p", true, 51, 31),
      seedancePriceTier("4k", true, 26, 16),
    ],
    promos: [],
  },
  generationFields: seedanceGenerationFields({
    durationMax: 15,
    resolutionDefault: "720p",
    resolutionValues: VIDEO_RESOLUTION_OPTIONS,
  }),
};

const SEEDANCE_2_FAST_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  sizePolicy: { enabled: false, effectMode: "legacy" },
  maxReferenceImages: 9,
  maxImageReferenceBytes: 31_457_280,
  maxReferenceVideos: 3,
  maxVideoReferenceBytes: 52_428_800,
  maxVideoReferenceSeconds: 60,
  maxReferenceAudios: 3,
  maxAudioReferenceBytes: 15_728_640,
  maxAudioReferenceSeconds: 15,
  promptMaxChars: 1000,
  supportsTaskCancel: true,
  priceEstimate: {
    enabled: true,
    tiers: [
      seedancePriceTier("480p", true, 37, 22),
      seedancePriceTier("720p", true, 37, 22),
      seedancePriceTier("1080p", false, 0, 0),
      seedancePriceTier("4k", false, 0, 0),
    ],
    promos: [
      {
        id: "30c706ea-ea51-41e5-9c65-624ae33bf19a",
        resolution: "any",
        startsAt: "2026-08-07",
        endsAt: "2026-09-07",
        discountFold: 7.5,
      },
    ],
  },
  generationFields: seedanceGenerationFields({
    durationMax: 15,
    resolutionDefault: "480p",
    resolutionValues: ["480p", "720p"],
  }),
};

const SEEDANCE_2_MINI_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  sizePolicy: { enabled: false, effectMode: "legacy" },
  maxReferenceImages: 9,
  maxImageReferenceBytes: 31_457_280,
  maxReferenceVideos: 3,
  maxVideoReferenceBytes: 52_428_800,
  maxVideoReferenceSeconds: 60,
  maxReferenceAudios: 3,
  maxAudioReferenceBytes: 15_728_640,
  maxAudioReferenceSeconds: 15,
  promptMaxChars: 1000,
  supportsTaskCancel: true,
  priceEstimate: {
    enabled: true,
    tiers: [
      seedancePriceTier("480p", true, 23, 14),
      seedancePriceTier("720p", true, 23, 14),
      seedancePriceTier("1080p", false, 0, 0),
      seedancePriceTier("4k", false, 0, 0),
    ],
    promos: [
      {
        id: "85f670d1-57ec-446a-ba69-1e4532c3de50",
        resolution: "any",
        startsAt: "2026-08-07",
        endsAt: "2026-09-07",
        discountFold: 4,
      },
    ],
  },
  generationFields: seedanceGenerationFields({
    durationMax: 15,
    resolutionDefault: "480p",
    resolutionValues: ["480p", "720p"],
  }),
};

const SEEDANCE_25_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  sizePolicy: { enabled: false, effectMode: "legacy" },
  maxReferenceImages: 30,
  maxImageReferenceBytes: 31_457_280,
  maxReferenceVideos: 10,
  maxVideoReferenceBytes: 52_428_800,
  maxVideoReferenceSeconds: 30,
  maxReferenceAudios: 10,
  maxAudioReferenceBytes: 15_728_640,
  maxAudioReferenceSeconds: 30,
  promptMaxChars: 1000,
  supportsTaskCancel: true,
  priceEstimate: {
    enabled: true,
    tiers: [
      seedancePriceTier("480p", true, 70, 42),
      seedancePriceTier("720p", true, 70, 42),
      seedancePriceTier("1080p", true, 77, 46),
      seedancePriceTier("4k", false, 0, 0),
    ],
    promos: [
      {
        id: "d25d8019-2cab-4229-a632-bf35321d96d8",
        resolution: "1080p",
        startsAt: "2026-08-14",
        endsAt: "2026-09-17",
        discountFold: 7.2,
      },
    ],
  },
  generationFields: seedanceGenerationFields({
    durationMax: 30,
    resolutionDefault: "720p",
    resolutionValues: ["480p", "720p", "1080p"],
  }),
};

export const SEEDANCE_PLATFORM_MODEL_DEFAULTS: Readonly<
  Record<SeedanceCanonicalId, SeedancePlatformModelDefault>
> = {
  "doubao-seedance-2": {
    canonicalId: "doubao-seedance-2",
    displayName: "Seedance 2.0",
    platformEnabled: true,
    description: "",
    sortOrder: 60,
    brandIcon: "doubao",
    parameterRules: SEEDANCE_2_RULES,
  },
  "doubao-seedance-2-fast": {
    canonicalId: "doubao-seedance-2-fast",
    displayName: "Seedance 2.0 Fast",
    platformEnabled: true,
    description: "",
    sortOrder: 70,
    brandIcon: "doubao",
    parameterRules: SEEDANCE_2_FAST_RULES,
  },
  "doubao-seedance-2-mini": {
    canonicalId: "doubao-seedance-2-mini",
    displayName: "Seedance 2.0 Mini",
    platformEnabled: true,
    description: "",
    sortOrder: 80,
    brandIcon: "doubao",
    parameterRules: SEEDANCE_2_MINI_RULES,
  },
  "doubao-seedance-2-5": {
    canonicalId: "doubao-seedance-2-5",
    displayName: "Seedance 2.5",
    platformEnabled: true,
    description: "",
    sortOrder: 75,
    brandIcon: "doubao",
    parameterRules: SEEDANCE_25_RULES,
  },
};

export function getSeedanceDefaultParameterRules(
  canonicalId: string
): VideoModelParameterRules | undefined {
  if (!isSeedanceCanonicalId(canonicalId)) {
    return undefined;
  }
  return SEEDANCE_PLATFORM_MODEL_DEFAULTS[canonicalId].parameterRules;
}
