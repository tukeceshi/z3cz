import type { OrgModelChannelKind } from "./format-platform-model-label";
import type { VideoModelParameterRules } from "./platform-ai-model";
import {
  resolveEffectiveVideoSupportsTaskCancel,
  type SingleModelCapabilityLimits,
} from "./single-model-capability-limits";
import type { SingleModelProviderMetadata } from "./single-model-interface-metadata";
import {
  isGrokImagineVideoCanonicalId,
  isVeoCanonicalId,
} from "./single-model-interface-metadata";
import type { SingleModelPresetCategory } from "./single-model-preset-catalog";
import { getSingleModelApiPath } from "./single-model-preset-catalog";

export interface SingleModelEndpointRules {
  readonly useOfficial?: boolean;
  readonly useFullSubmitUrl?: boolean;
}

export interface ResolvedSingleModelVideoEndpoints {
  readonly submitPath: string;
  readonly supportsTaskCancel: boolean;
  readonly useFullSubmitUrl: boolean;
}

export const OFFICIAL_VIDEO_SUBMIT_PATH = "/contents/generations/tasks" as const;

export function usesOfficialSingleModelEndpointRules(
  metadata: Pick<SingleModelProviderMetadata, "endpointRules"> | null | undefined
): boolean {
  return metadata?.endpointRules?.useOfficial !== false;
}

export function resolveDefaultVideoSubmitPath(
  category: SingleModelPresetCategory | string = "video"
): string {
  if (category === "storage") {
    return OFFICIAL_VIDEO_SUBMIT_PATH;
  }
  return (
    getSingleModelApiPath(
      category as Exclude<SingleModelPresetCategory, "storage">
    ) ?? OFFICIAL_VIDEO_SUBMIT_PATH
  );
}

export function resolveOfficialVideoEndpoints(
  category: SingleModelPresetCategory | string = "video"
): ResolvedSingleModelVideoEndpoints {
  return {
    submitPath: resolveDefaultVideoSubmitPath(category),
    supportsTaskCancel: true,
    useFullSubmitUrl: false,
  };
}

export function resolveSingleModelVideoEndpoints(params: {
  readonly metadata?: Pick<
    SingleModelProviderMetadata,
    "endpointRules" | "singleModelCategory"
  > | null;
  readonly category?: SingleModelPresetCategory | string;
  readonly supportsTaskCancel?: boolean;
}): ResolvedSingleModelVideoEndpoints {
  const category = params.category ?? params.metadata?.singleModelCategory ?? "video";
  const submitPath = resolveDefaultVideoSubmitPath(category);
  const useFullSubmitUrl = params.metadata?.endpointRules?.useFullSubmitUrl === true;

  if (usesOfficialSingleModelEndpointRules(params.metadata ?? undefined)) {
    return {
      submitPath,
      supportsTaskCancel: params.supportsTaskCancel ?? true,
      useFullSubmitUrl,
    };
  }

  return {
    submitPath,
    supportsTaskCancel: params.supportsTaskCancel === true,
    useFullSubmitUrl,
  };
}

export function buildVideoSubmitUrl(params: {
  readonly baseUrl: string;
  readonly submitPath: string;
  readonly useFullSubmitUrl?: boolean;
}): string {
  if (params.useFullSubmitUrl) {
    return params.baseUrl.trim().replace(/\/$/, "");
  }

  const base = params.baseUrl.trim().replace(/\/$/, "");
  const path = params.submitPath;
  if (base.endsWith(path)) {
    return base;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildVideoPollUrl(params: {
  readonly baseUrl: string;
  readonly submitPath: string;
  readonly taskId: string;
  readonly useFullSubmitUrl?: boolean;
}): string {
  const submitUrl = buildVideoSubmitUrl({
    baseUrl: params.baseUrl,
    submitPath: params.submitPath,
    useFullSubmitUrl: params.useFullSubmitUrl,
  });
  return `${submitUrl.replace(/\/$/, "")}/${encodeURIComponent(params.taskId)}`;
}

export function validateCustomSingleModelEndpointRules(params: {
  readonly category: SingleModelPresetCategory | string;
  readonly rules: SingleModelEndpointRules;
}): string | null {
  if (params.rules.useOfficial !== false) {
    return null;
  }
  return null;
}

export function endpointRulesForMetadata(params: {
  readonly useOfficial: boolean;
  readonly useFullSubmitUrl: boolean;
}): SingleModelEndpointRules | undefined {
  if (!params.useOfficial) {
    return params.useFullSubmitUrl
      ? { useOfficial: false, useFullSubmitUrl: true }
      : { useOfficial: false };
  }
  return params.useFullSubmitUrl ? { useFullSubmitUrl: true } : undefined;
}

export interface SingleModelEndpointUrlPreview {
  readonly fullUrlPreview: string | null;
}

export function buildSingleModelEndpointUrlPreview(params: {
  readonly baseUrl: string;
  readonly category: SingleModelPresetCategory | string;
  readonly useFullSubmitUrl?: boolean;
}): SingleModelEndpointUrlPreview {
  const trimmedBase = params.baseUrl.trim();
  if (!trimmedBase) {
    return { fullUrlPreview: null };
  }

  const submitPath = resolveDefaultVideoSubmitPath(params.category);
  return {
    fullUrlPreview: buildVideoSubmitUrl({
      baseUrl: trimmedBase,
      submitPath,
      useFullSubmitUrl: params.useFullSubmitUrl === true,
    }),
  };
}

export function buildDefaultVideoSubmitUrl(baseUrl: string): string {
  return buildVideoSubmitUrl({
    baseUrl,
    submitPath: OFFICIAL_VIDEO_SUBMIT_PATH,
    useFullSubmitUrl: false,
  });
}

export function resolveVideoTaskCancelSupport(params: {
  readonly canonicalId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly platformRules?: VideoModelParameterRules;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}): boolean {
  if (
    isGrokImagineVideoCanonicalId(params.canonicalId) ||
    isVeoCanonicalId(params.canonicalId)
  ) {
    return false;
  }

  if (params.channelKind === "aggregate") {
    return true;
  }

  if (!params.platformRules) {
    return false;
  }

  return resolveEffectiveVideoSupportsTaskCancel({
    platformRules: params.platformRules,
    capabilityLimits: params.capabilityLimits,
  });
}
