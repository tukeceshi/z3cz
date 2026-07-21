import type { AiModelModality } from "./ai-model-catalog";
import type { UpstreamParamProfileField } from "./upstream-param-profile";
import type { ObjectReference } from "./workflow";

export const PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION = 1 as const;

export interface TextModelReferenceInputRule {
  readonly type: "string" | "image" | "video" | "any";
  readonly field: "keywords";
  readonly maxCount: number;
}

export interface TextModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly referenceInputs: readonly TextModelReferenceInputRule[];
  readonly keywordsMaxChars: number;
  readonly promptMaxChars: number;
  readonly outputMaxTokens: number;
  readonly outputMaxTokensLimit: number;
  readonly outputMaxChars: number;
  readonly contextWindowTokens: number;
  /** Max text references connected into the AI text node. */
  readonly maxTextReferences: number;
  /** Max characters per text reference. */
  readonly maxTextReferenceChars: number;
  /** Max image references. */
  readonly maxImageReferences: number;
  /** Max bytes per image reference. */
  readonly maxImageReferenceBytes: number;
  /** Max video references. */
  readonly maxVideoReferences: number;
  /** Max bytes per video reference. */
  readonly maxVideoReferenceBytes: number;
  /** Max video duration in seconds. */
  readonly maxVideoReferenceSeconds: number;
  /** Allow clicking text refs to insert into the prompt box. */
  readonly allowPromptInjectText: boolean;
  /** Allow clicking image refs to insert into the prompt box. */
  readonly allowPromptInjectImage: boolean;
  /** Allow clicking video refs to insert into the prompt box. */
  readonly allowPromptInjectVideo: boolean;
}

export interface ImageModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly maxReferenceImages: number;
  readonly maxImageReferenceBytes: number;
  readonly promptMaxChars: number;
  readonly generationFields: readonly UpstreamParamProfileField[];
}

export interface VideoModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly maxReferenceImages: number;
  readonly maxImageReferenceBytes: number;
  readonly maxReferenceVideos: number;
  readonly maxVideoReferenceBytes: number;
  readonly maxVideoReferenceSeconds: number;
  readonly promptMaxChars: number;
  readonly generationFields: readonly UpstreamParamProfileField[];
}

export type PlatformAiModelParameterRules =
  | TextModelParameterRules
  | ImageModelParameterRules
  | VideoModelParameterRules;

export interface PlatformAiModel {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly platformEnabled: boolean;
  readonly providerModelId: string;
  readonly parameterRules: PlatformAiModelParameterRules;
  readonly sortOrder: number;
  readonly groupId: string | null;
  readonly description: string;
  readonly updatedAt?: string;
}

export interface PlatformAiModelGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly sortOrder: number;
  readonly updatedAt?: string;
}

export interface UpdatePlatformAiModelRequest {
  readonly displayName?: string;
  readonly platformEnabled?: boolean;
  readonly providerModelId?: string;
  readonly parameterRules?: PlatformAiModelParameterRules;
  readonly sortOrder?: number;
  readonly groupId?: string | null;
  readonly description?: string;
}

export interface CreatePlatformAiModelGroupRequest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sortOrder?: number;
}

export interface UpdatePlatformAiModelGroupRequest {
  readonly name?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sortOrder?: number;
}

export interface ListPlatformAiModelGroupsResponse {
  readonly groups: readonly PlatformAiModelGroup[];
}

export interface ReorderPlatformAiModelsRequest {
  readonly orderedCanonicalIds: readonly string[];
}

export interface ListPlatformAiModelsResponse {
  readonly models: readonly PlatformAiModel[];
  readonly groups?: readonly PlatformAiModelGroup[];
}

export type OrgTextModelUnavailableReason =
  | "no_org_interface"
  | "model_disabled_on_interface"
  | "model_missing_on_interface";

export interface OrgTextModelOption {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: TextModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgTextModelUnavailableReason;
  readonly description: string;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly groupDescription: string | null;
  readonly groupIcon: string | null;
}

export interface ListOrgTextModelsResponse {
  readonly models: readonly OrgTextModelOption[];
  readonly groups: readonly PlatformAiModelGroup[];
}

export interface OrganizationModelInterfacePriority {
  readonly canonicalId: string;
  readonly interfaceIds: readonly string[];
}

export interface ListModelInterfacePrioritiesResponse {
  readonly priorities: readonly OrganizationModelInterfacePriority[];
}

export interface UpdateModelInterfacePriorityRequest {
  readonly canonicalId: string;
  readonly interfaceIds: readonly string[];
}

export type AiModelInvocationStatus = "completed" | "failed";

export interface AiModelInvocation {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string | null;
  readonly interfaceName: string | null;
  readonly promptExcerpt: string;
  readonly content: string;
  readonly source: string;
  readonly status: AiModelInvocationStatus;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface ListAiModelInvocationsResponse {
  readonly invocations: readonly AiModelInvocation[];
  readonly total: number;
}

export interface GenerateAiTextRequest {
  readonly modelCanonicalId: string;
  readonly prompt?: string;
  readonly keywords?: string;
  readonly workflowId?: string;
  readonly nodeId?: string;
}

export interface GenerateAiTextResponse {
  readonly text: string;
  readonly invocationId: string;
  readonly aiInterfaceId: string;
}

export interface AiTextResultHistoryItem {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
}

export interface AiTextResultHistory {
  readonly items: readonly AiTextResultHistoryItem[];
  readonly selectedId: string | null;
}

export type OrgImageModelUnavailableReason = OrgTextModelUnavailableReason;

export interface OrgImageModelOption {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: ImageModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgImageModelUnavailableReason;
  readonly description: string;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly groupDescription: string | null;
  readonly groupIcon: string | null;
}

export interface ListOrgImageModelsResponse {
  readonly models: readonly OrgImageModelOption[];
  readonly groups: readonly PlatformAiModelGroup[];
}

export interface GenerateAiImageRequest {
  readonly modelCanonicalId: string;
  readonly prompt?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly workflowId?: string;
  readonly nodeId?: string;
}

import type { MediaReference } from "./media-reference";

export interface GenerateAiImageResponse {
  readonly images: readonly MediaReference[];
  readonly invocationId: string;
  readonly aiInterfaceId: string;
  readonly storageMode: "ephemeral" | "cloud";
}

export type OrgVideoModelUnavailableReason = OrgTextModelUnavailableReason;

export interface OrgVideoModelOption {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: VideoModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgVideoModelUnavailableReason;
  readonly description: string;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly groupDescription: string | null;
  readonly groupIcon: string | null;
}

export interface ListOrgVideoModelsResponse {
  readonly models: readonly OrgVideoModelOption[];
  readonly groups: readonly PlatformAiModelGroup[];
}

export interface SubmitAiVideoRequest {
  readonly modelCanonicalId: string;
  readonly prompt?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly workflowId?: string;
  readonly nodeId?: string;
}

export interface SubmitAiVideoResponse {
  readonly taskId: string;
  readonly invocationId: string;
  readonly aiInterfaceId: string;
}

export interface PollAiVideoTaskResponse {
  readonly status: "queued" | "running" | "succeeded" | "failed" | "expired";
  readonly videoUrl?: string;
  readonly error?: string;
}

export interface AiImageResultHistoryItem {
  readonly id: string;
  readonly images: readonly MediaReference[];
  readonly prompt: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface AiImageResultHistory {
  readonly items: readonly AiImageResultHistoryItem[];
  readonly selectedId: string | null;
}

export interface AiVideoResultHistoryItem {
  readonly id: string;
  readonly videos: readonly MediaReference[];
  readonly prompt: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface AiVideoResultHistory {
  readonly items: readonly AiVideoResultHistoryItem[];
  readonly selectedId: string | null;
}

export const DEEPSEEK_V4_FLASH_CANONICAL_ID = "deepseek-v4-flash" as const;

export const DEFAULT_TEXT_MODEL_PARAMETER_RULES: TextModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  referenceInputs: [{ type: "any", field: "keywords", maxCount: 4 }],
  keywordsMaxChars: 32_000,
  promptMaxChars: 32_000,
  outputMaxTokens: 4096,
  outputMaxTokensLimit: 8192,
  outputMaxChars: 32_000,
  contextWindowTokens: 1_048_576,
  maxTextReferences: 4,
  maxTextReferenceChars: 32_000,
  maxImageReferences: 0,
  maxImageReferenceBytes: 10 * 1024 * 1024,
  maxVideoReferences: 0,
  maxVideoReferenceBytes: 50 * 1024 * 1024,
  maxVideoReferenceSeconds: 60,
  allowPromptInjectText: true,
  allowPromptInjectImage: false,
  allowPromptInjectVideo: false,
};

export const DEFAULT_IMAGE_GENERATION_FIELDS: readonly UpstreamParamProfileField[] =
  [
    {
      name: "size",
      apiName: "size",
      type: "string",
      description: "Output size preset or pixel dimensions",
      default: "2K",
      enumValues: [
        "2K",
        "3K",
        "2048x2048",
        "1728x2304",
        "2304x1728",
        "2848x1600",
        "1600x2848",
      ],
    },
    {
      name: "output_format",
      apiName: "output_format",
      type: "string",
      description: "Generated image file format",
      default: "png",
      enumValues: ["png", "jpeg"],
    },
    {
      name: "watermark",
      apiName: "watermark",
      type: "boolean",
      description: "Add AI-generated watermark",
      default: false,
    },
    {
      name: "sequential_image_generation",
      apiName: "sequential_image_generation",
      type: "string",
      description: "Single image or auto multi-image set",
      default: "disabled",
      enumValues: ["disabled", "auto"],
    },
    {
      name: "max_images",
      apiName: "sequential_image_generation_options.max_images",
      type: "number",
      description: "Max images when sequential mode is auto",
      default: 1,
      hidden: true,
    },
    {
      name: "optimize_prompt_mode",
      apiName: "optimize_prompt_options.mode",
      type: "string",
      description: "Prompt optimization mode",
      default: "standard",
      enumValues: ["standard", "fast"],
    },
    {
      name: "web_search",
      apiName: "web_search",
      type: "boolean",
      description: "Enable web search tools when supported",
      default: false,
    },
  ] as const;

export const DEFAULT_IMAGE_MODEL_PARAMETER_RULES: ImageModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  maxReferenceImages: 4,
  maxImageReferenceBytes: 10 * 1024 * 1024,
  promptMaxChars: 600,
  generationFields: DEFAULT_IMAGE_GENERATION_FIELDS,
};

export const DEFAULT_VIDEO_GENERATION_FIELDS: readonly UpstreamParamProfileField[] =
  [
    {
      name: "ratio",
      apiName: "ratio",
      type: "string",
      description: "Output aspect ratio",
      default: "16:9",
      enumValues: ["16:9", "9:16", "4:3", "1:1", "3:4", "21:9", "adaptive"],
    },
    {
      name: "duration",
      apiName: "duration",
      type: "number",
      description: "Video duration in seconds",
      default: 5,
    },
    {
      name: "resolution",
      apiName: "resolution",
      type: "string",
      description: "Output resolution",
      default: "720p",
      enumValues: ["480p", "720p", "1080p"],
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
      name: "seed",
      apiName: "seed",
      type: "number",
      description: "Random seed (-1 for random)",
      default: -1,
    },
  ] as const;

export const DEFAULT_VIDEO_MODEL_PARAMETER_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  maxReferenceImages: 2,
  maxImageReferenceBytes: 10 * 1024 * 1024,
  maxReferenceVideos: 1,
  maxVideoReferenceBytes: 50 * 1024 * 1024,
  maxVideoReferenceSeconds: 60,
  promptMaxChars: 600,
  generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
};

export function isTextModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is TextModelParameterRules {
  return "promptMaxChars" in rules;
}

export function isImageModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is ImageModelParameterRules {
  return (
    "maxReferenceImages" in rules &&
    !("referenceInputs" in rules) &&
    !("maxReferenceVideos" in rules)
  );
}

export function isVideoModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is VideoModelParameterRules {
  return "maxReferenceVideos" in rules && !("referenceInputs" in rules);
}

export function normalizeVideoModelParameterRules(
  rules: VideoModelParameterRules
): VideoModelParameterRules {
  const generationFields =
    rules.generationFields?.length > 0
      ? rules.generationFields
      : DEFAULT_VIDEO_MODEL_PARAMETER_RULES.generationFields;

  return {
    ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
    ...rules,
    maxReferenceImages:
      rules.maxReferenceImages ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceImages,
    maxImageReferenceBytes:
      rules.maxImageReferenceBytes ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
    maxReferenceVideos:
      rules.maxReferenceVideos ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos,
    maxVideoReferenceBytes:
      rules.maxVideoReferenceBytes ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
    maxVideoReferenceSeconds:
      rules.maxVideoReferenceSeconds ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
    promptMaxChars:
      rules.promptMaxChars ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.promptMaxChars,
    generationFields,
  };
}

export function normalizeImageModelParameterRules(
  rules: ImageModelParameterRules
): ImageModelParameterRules {
  const generationFields =
    rules.generationFields?.length > 0
      ? rules.generationFields
      : DEFAULT_IMAGE_MODEL_PARAMETER_RULES.generationFields;

  return {
    ...DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
    ...rules,
    maxReferenceImages:
      rules.maxReferenceImages ??
      DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxReferenceImages,
    maxImageReferenceBytes:
      rules.maxImageReferenceBytes ??
      DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
    promptMaxChars:
      rules.promptMaxChars ??
      DEFAULT_IMAGE_MODEL_PARAMETER_RULES.promptMaxChars,
    generationFields,
  };
}

/** Build Volcano /images/generations body from admin field definitions. */
export function buildVolcanoImageGenerationBody(params: {
  readonly providerModelId: string;
  readonly prompt: string;
  readonly generationFields: readonly UpstreamParamProfileField[];
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.providerModelId,
    prompt: params.prompt,
    stream: false,
    response_format: "url",
  };

  for (const field of params.generationFields) {
    const raw = params.params?.[field.name];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field.default
        : raw;

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.apiName === "web_search") {
      if (value === true) {
        body.tools = [{ type: "web_search" }];
      }
      continue;
    }

    if (field.apiName.includes(".")) {
      const [root, leaf] = field.apiName.split(".", 2);
      const existing =
        body[root] && typeof body[root] === "object"
          ? (body[root] as Record<string, unknown>)
          : {};
      body[root] = { ...existing, [leaf!]: value };
      continue;
    }

    body[field.apiName] = value;
  }

  const urls = params.referenceImageUrls?.filter(Boolean) ?? [];
  if (urls.length === 1) {
    body.image = urls[0];
  } else if (urls.length > 1) {
    body.image = urls;
  }

  return body;
}

/** Build Volcano /contents/generations/tasks body from admin field definitions. */
export function buildVolcanoVideoGenerationBody(params: {
  readonly providerModelId: string;
  readonly prompt: string;
  readonly generationFields: readonly UpstreamParamProfileField[];
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
}): Record<string, unknown> {
  const trimmedPrompt = params.prompt.trim();
  const content: Record<string, unknown>[] = [
    { type: "text", text: trimmedPrompt },
  ];

  const urls = params.referenceImageUrls?.filter(Boolean) ?? [];
  if (urls.length === 1) {
    content.push({
      type: "image_url",
      image_url: { url: urls[0] },
      role: "first_frame",
    });
  } else if (urls.length > 1) {
    for (const url of urls) {
      content.push({
        type: "image_url",
        image_url: { url },
        role: "reference_image",
      });
    }
  }

  const body: Record<string, unknown> = {
    model: params.providerModelId,
    content,
  };

  for (const field of params.generationFields) {
    const raw = params.params?.[field.name];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field.default
        : raw;

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.apiName.includes(".")) {
      const [root, leaf] = field.apiName.split(".", 2);
      const existing =
        body[root] && typeof body[root] === "object"
          ? (body[root] as Record<string, unknown>)
          : {};
      body[root] = { ...existing, [leaf!]: value };
      continue;
    }

    body[field.apiName] = value;
  }

  return body;
}

/** Normalize older DB rows that lack the newer reference-limit fields. */
export function normalizeTextModelParameterRules(
  rules: TextModelParameterRules
): TextModelParameterRules {
  return {
    ...DEFAULT_TEXT_MODEL_PARAMETER_RULES,
    ...rules,
    referenceInputs:
      rules.referenceInputs?.length > 0
        ? rules.referenceInputs.map((entry) => ({
            type: entry.type ?? "any",
            field: "keywords" as const,
            maxCount:
              typeof entry.maxCount === "number"
                ? entry.maxCount
                : DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxTextReferences,
          }))
        : DEFAULT_TEXT_MODEL_PARAMETER_RULES.referenceInputs,
    maxTextReferences:
      rules.maxTextReferences ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxTextReferences,
    maxTextReferenceChars:
      rules.maxTextReferenceChars ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxTextReferenceChars,
    maxImageReferences:
      rules.maxImageReferences ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxImageReferences,
    maxImageReferenceBytes:
      rules.maxImageReferenceBytes ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
    maxVideoReferences:
      rules.maxVideoReferences ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxVideoReferences,
    maxVideoReferenceBytes:
      rules.maxVideoReferenceBytes ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
    maxVideoReferenceSeconds:
      rules.maxVideoReferenceSeconds ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
    allowPromptInjectText:
      rules.allowPromptInjectText ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.allowPromptInjectText,
    allowPromptInjectImage:
      rules.allowPromptInjectImage ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.allowPromptInjectImage,
    allowPromptInjectVideo:
      rules.allowPromptInjectVideo ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.allowPromptInjectVideo,
  };
}

export function resolveAiTextEffectivePrompt(params: {
  readonly keywords?: unknown;
  readonly prompt?: unknown;
}): string {
  const keywords = normalizeAiTextKeywordsValue(params.keywords);
  const prompt =
    typeof params.prompt === "string" ? params.prompt.trim() : "";

  if (keywords && prompt) {
    return `${keywords}\n\n${prompt}`;
  }
  return keywords || prompt;
}

function normalizeAiTextKeywordsValue(keywords: unknown): string {
  if (typeof keywords === "string" && keywords.trim().length > 0) {
    return keywords.trim();
  }
  if (Array.isArray(keywords)) {
    const joined = keywords
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .join("\n");
    if (joined.length > 0) return joined;
  }
  return "";
}
