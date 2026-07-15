import type { AiModelModality } from "./ai-model-catalog";

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
}

export interface VideoModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly maxReferenceVideos: number;
  readonly maxVideoReferenceBytes: number;
  readonly maxVideoReferenceSeconds: number;
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

export const DEFAULT_IMAGE_MODEL_PARAMETER_RULES: ImageModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  maxReferenceImages: 4,
  maxImageReferenceBytes: 10 * 1024 * 1024,
};

export const DEFAULT_VIDEO_MODEL_PARAMETER_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  maxReferenceVideos: 1,
  maxVideoReferenceBytes: 50 * 1024 * 1024,
  maxVideoReferenceSeconds: 60,
};

export function isTextModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is TextModelParameterRules {
  return "promptMaxChars" in rules;
}

export function isImageModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is ImageModelParameterRules {
  return "maxReferenceImages" in rules && !("promptMaxChars" in rules);
}

export function isVideoModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is VideoModelParameterRules {
  return "maxReferenceVideos" in rules && !("promptMaxChars" in rules);
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
  if (typeof params.keywords === "string" && params.keywords.trim().length > 0) {
    return params.keywords.trim();
  }
  if (Array.isArray(params.keywords)) {
    const joined = params.keywords
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .join("\n");
    if (joined.length > 0) return joined;
  }
  if (typeof params.prompt === "string") {
    return params.prompt.trim();
  }
  return "";
}
