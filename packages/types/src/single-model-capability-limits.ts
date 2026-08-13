import type { VideoModelParameterRules } from "./platform-ai-model";
import { normalizeVideoModelParameterRules } from "./platform-ai-model";
import type { UpstreamParamProfileField } from "./upstream-param-profile";

/** Org-side restrictions on platform video model capabilities. */
export interface SingleModelCapabilityLimits {
  /** When false, hide task cancel in UI. Org cannot enable if platform disallows. */
  readonly supportsTaskCancel?: boolean;
  /** Full resolution field copied from platform baseline, then narrowed in org UI. */
  readonly resolution?: UpstreamParamProfileField;
  readonly maxReferenceImages?: number;
  readonly maxReferenceVideos?: number;
  readonly maxReferenceAudios?: number;
  /** Full duration field copied from platform baseline, then narrowed in org UI. */
  readonly duration?: UpstreamParamProfileField;
}

export interface PlatformVideoCapabilityBaseline {
  readonly supportsTaskCancel: boolean;
  readonly resolution: UpstreamParamProfileField | null;
  readonly duration: UpstreamParamProfileField | null;
  readonly maxReferenceImages: number;
  readonly maxReferenceVideos: number;
  readonly maxReferenceAudios: number;
}

interface LegacySingleModelCapabilityLimits extends SingleModelCapabilityLimits {
  readonly resolutions?: readonly string[];
}

export function readResolutionFieldFromVideoRules(
  rules: VideoModelParameterRules
): UpstreamParamProfileField | null {
  const normalized = normalizeVideoModelParameterRules(rules);
  const field = normalized.generationFields.find(
    (entry) => entry.name === "resolution" && !entry.hidden
  );
  return field ?? null;
}

export function readDurationFieldFromVideoRules(
  rules: VideoModelParameterRules
): UpstreamParamProfileField | null {
  const normalized = normalizeVideoModelParameterRules(rules);
  const field = normalized.generationFields.find(
    (entry) => entry.name === "duration" && !entry.hidden
  );
  return field ?? null;
}

export function readVideoReferenceCountsFromRules(
  rules: VideoModelParameterRules
): Pick<
  PlatformVideoCapabilityBaseline,
  "maxReferenceImages" | "maxReferenceVideos" | "maxReferenceAudios"
> {
  const normalized = normalizeVideoModelParameterRules(rules);
  return {
    maxReferenceImages: normalized.maxReferenceImages,
    maxReferenceVideos: normalized.maxReferenceVideos,
    maxReferenceAudios: normalized.maxReferenceAudios,
  };
}

export function buildPlatformVideoCapabilityBaseline(params: {
  readonly rules: VideoModelParameterRules;
}): PlatformVideoCapabilityBaseline {
  return {
    supportsTaskCancel: resolvePlatformVideoSupportsTaskCancel(params.rules),
    resolution: readResolutionFieldFromVideoRules(params.rules),
    duration: readDurationFieldFromVideoRules(params.rules),
    ...readVideoReferenceCountsFromRules(params.rules),
  };
}

export function readResolutionOptionsFromVideoRules(
  rules: VideoModelParameterRules
): readonly string[] {
  return readResolutionFieldFromVideoRules(rules)?.enumValues ?? [];
}

export function cloneGenerationProfileField(
  field: UpstreamParamProfileField
): UpstreamParamProfileField {
  return {
    ...field,
    enumValues: field.enumValues ? [...field.enumValues] : undefined,
  };
}

/** @deprecated Use cloneGenerationProfileField */
export function cloneResolutionField(
  field: UpstreamParamProfileField
): UpstreamParamProfileField {
  return cloneGenerationProfileField(field);
}

export function areGenerationProfileFieldsEqual(
  left: UpstreamParamProfileField,
  right: UpstreamParamProfileField
): boolean {
  const leftEnum = left.enumValues ?? [];
  const rightEnum = right.enumValues ?? [];
  if (
    leftEnum.length !== rightEnum.length ||
    !leftEnum.every((entry, index) => entry === rightEnum[index])
  ) {
    return false;
  }
  return String(left.default ?? "") === String(right.default ?? "");
}

/** @deprecated Use areGenerationProfileFieldsEqual */
export function areResolutionFieldsEqual(
  left: UpstreamParamProfileField,
  right: UpstreamParamProfileField
): boolean {
  return areGenerationProfileFieldsEqual(left, right);
}

export function resolvePlatformVideoSupportsTaskCancel(
  rules: VideoModelParameterRules
): boolean {
  const normalized = normalizeVideoModelParameterRules(rules);
  return normalized.supportsTaskCancel !== false;
}

export function resolveEffectiveVideoSupportsTaskCancel(params: {
  readonly platformRules: VideoModelParameterRules;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}): boolean {
  const platformAllows = resolvePlatformVideoSupportsTaskCancel(
    params.platformRules
  );
  if (!platformAllows) {
    return false;
  }
  if (params.capabilityLimits?.supportsTaskCancel === false) {
    return false;
  }
  return true;
}

export function resolveEffectiveResolutionField(params: {
  readonly platformBaseline: {
    readonly resolution: UpstreamParamProfileField | null;
  } | null;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}): UpstreamParamProfileField | null {
  if (params.capabilityLimits?.resolution) {
    return params.capabilityLimits.resolution;
  }
  return params.platformBaseline?.resolution ?? null;
}

export function resolveEffectiveDurationField(params: {
  readonly platformBaseline: {
    readonly duration: UpstreamParamProfileField | null;
  } | null;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}): UpstreamParamProfileField | null {
  if (params.capabilityLimits?.duration) {
    return params.capabilityLimits.duration;
  }
  return params.platformBaseline?.duration ?? null;
}

export function resolveEffectiveReferenceCounts(params: {
  readonly platformBaseline: Pick<
    PlatformVideoCapabilityBaseline,
    "maxReferenceImages" | "maxReferenceVideos" | "maxReferenceAudios"
  >;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}): Pick<
  PlatformVideoCapabilityBaseline,
  "maxReferenceImages" | "maxReferenceVideos" | "maxReferenceAudios"
> {
  return {
    maxReferenceImages:
      params.capabilityLimits?.maxReferenceImages ??
      params.platformBaseline.maxReferenceImages,
    maxReferenceVideos:
      params.capabilityLimits?.maxReferenceVideos ??
      params.platformBaseline.maxReferenceVideos,
    maxReferenceAudios:
      params.capabilityLimits?.maxReferenceAudios ??
      params.platformBaseline.maxReferenceAudios,
  };
}

function normalizeStoredCapabilityLimits(
  stored: SingleModelCapabilityLimits,
  platformBaseline: Pick<PlatformVideoCapabilityBaseline, "resolution">
): SingleModelCapabilityLimits {
  if (stored.resolution) {
    return stored;
  }

  const legacy = stored as LegacySingleModelCapabilityLimits;
  if (!legacy.resolutions?.length || !platformBaseline.resolution) {
    return stored;
  }

  const platformEnum = platformBaseline.resolution.enumValues ?? [];
  const filtered = legacy.resolutions.filter((entry) =>
    platformEnum.includes(entry)
  );
  const enumValues =
    filtered.length > 0 ? filtered : [...platformEnum];
  const defaultValue = enumValues.includes(
    String(platformBaseline.resolution.default)
  )
    ? platformBaseline.resolution.default
    : enumValues[0];

  return {
    ...stored,
    resolution: {
      ...platformBaseline.resolution,
      enumValues,
      default: defaultValue,
    },
  };
}

function replaceGenerationField(
  fields: readonly UpstreamParamProfileField[],
  replacement: UpstreamParamProfileField
): UpstreamParamProfileField[] {
  const index = fields.findIndex((field) => field.name === replacement.name);
  if (index === -1) {
    return [...fields, replacement];
  }
  return fields.map((field, fieldIndex) =>
    fieldIndex === index ? { ...replacement } : field
  );
}

function isGenerationProfileFieldSubset(params: {
  readonly orgField: UpstreamParamProfileField;
  readonly platformField: UpstreamParamProfileField;
}): boolean {
  const platformOptions = new Set(params.platformField.enumValues ?? []);
  const orgOptions = params.orgField.enumValues ?? [];
  if (orgOptions.length === 0) {
    return false;
  }
  if (!orgOptions.every((option) => platformOptions.has(option))) {
    return false;
  }

  const orgDefault = String(params.orgField.default ?? "");
  if (orgDefault.length > 0 && !orgOptions.includes(orgDefault)) {
    return false;
  }

  return true;
}

export function applyVideoCapabilityLimits(
  platformRules: VideoModelParameterRules,
  capabilityLimits?: SingleModelCapabilityLimits | null
): VideoModelParameterRules {
  const normalized = normalizeVideoModelParameterRules(platformRules);
  if (!capabilityLimits) {
    return normalized;
  }

  const migrated = normalizeStoredCapabilityLimits(capabilityLimits, {
    resolution: readResolutionFieldFromVideoRules(normalized),
  });

  let generationFields = normalized.generationFields;
  if (migrated.resolution) {
    generationFields = replaceGenerationField(
      generationFields,
      migrated.resolution
    );
  }
  if (migrated.duration) {
    generationFields = replaceGenerationField(
      generationFields,
      migrated.duration
    );
  }

  return {
    ...normalized,
    ...(migrated.supportsTaskCancel !== undefined
      ? { supportsTaskCancel: migrated.supportsTaskCancel }
      : {}),
    ...(migrated.maxReferenceImages !== undefined
      ? { maxReferenceImages: migrated.maxReferenceImages }
      : {}),
    ...(migrated.maxReferenceVideos !== undefined
      ? { maxReferenceVideos: migrated.maxReferenceVideos }
      : {}),
    ...(migrated.maxReferenceAudios !== undefined
      ? { maxReferenceAudios: migrated.maxReferenceAudios }
      : {}),
    generationFields,
  };
}

export function capabilityLimitsFromLegacyFormatTransform(params: {
  readonly supportsTaskCancel?: boolean;
  readonly lockedResolution?: string | null;
  readonly platformRules: VideoModelParameterRules;
}): SingleModelCapabilityLimits | undefined {
  const platformField = readResolutionFieldFromVideoRules(params.platformRules);
  const limits: SingleModelCapabilityLimits = {};

  if (params.supportsTaskCancel === false) {
    limits.supportsTaskCancel = false;
  }

  if (params.lockedResolution && platformField) {
    const platformEnum = platformField.enumValues ?? [];
    if (platformEnum.includes(params.lockedResolution)) {
      return {
        ...limits,
        resolution: {
          ...platformField,
          enumValues: [params.lockedResolution],
          default: params.lockedResolution,
        },
      };
    }
  }

  if (Object.keys(limits).length === 0) {
    return undefined;
  }

  return limits;
}

function hasCapabilityLimitValues(
  limits: SingleModelCapabilityLimits
): boolean {
  return (
    limits.supportsTaskCancel !== undefined ||
    limits.resolution !== undefined ||
    limits.maxReferenceImages !== undefined ||
    limits.maxReferenceVideos !== undefined ||
    limits.maxReferenceAudios !== undefined ||
    limits.duration !== undefined
  );
}

export function normalizeCapabilityLimitsForSave(params: {
  readonly platformBaseline: PlatformVideoCapabilityBaseline;
  readonly limits: SingleModelCapabilityLimits;
}): SingleModelCapabilityLimits | null {
  const result: SingleModelCapabilityLimits = {};

  if (
    params.limits.supportsTaskCancel !== undefined &&
    params.limits.supportsTaskCancel !== params.platformBaseline.supportsTaskCancel
  ) {
    result.supportsTaskCancel = params.limits.supportsTaskCancel;
  }

  if (
    params.limits.resolution &&
    params.platformBaseline.resolution &&
    !areGenerationProfileFieldsEqual(
      params.limits.resolution,
      params.platformBaseline.resolution
    )
  ) {
    result.resolution = params.limits.resolution;
  }

  if (
    params.limits.duration &&
    params.platformBaseline.duration &&
    !areGenerationProfileFieldsEqual(
      params.limits.duration,
      params.platformBaseline.duration
    )
  ) {
    result.duration = params.limits.duration;
  }

  if (
    params.limits.maxReferenceImages !== undefined &&
    params.limits.maxReferenceImages !==
      params.platformBaseline.maxReferenceImages
  ) {
    result.maxReferenceImages = params.limits.maxReferenceImages;
  }

  if (
    params.limits.maxReferenceVideos !== undefined &&
    params.limits.maxReferenceVideos !== params.platformBaseline.maxReferenceVideos
  ) {
    result.maxReferenceVideos = params.limits.maxReferenceVideos;
  }

  if (
    params.limits.maxReferenceAudios !== undefined &&
    params.limits.maxReferenceAudios !== params.platformBaseline.maxReferenceAudios
  ) {
    result.maxReferenceAudios = params.limits.maxReferenceAudios;
  }

  if (!hasCapabilityLimitValues(result)) {
    return null;
  }

  return result;
}

export function resolveEffectiveCapabilityLimitsForEdit(params: {
  readonly platformBaseline: PlatformVideoCapabilityBaseline;
  readonly storedLimits?: SingleModelCapabilityLimits | null;
}): SingleModelCapabilityLimits {
  const stored = params.storedLimits
    ? normalizeStoredCapabilityLimits(
        params.storedLimits,
        params.platformBaseline
      )
    : null;

  const resolution = stored?.resolution
    ? cloneGenerationProfileField(stored.resolution)
    : params.platformBaseline.resolution
      ? cloneGenerationProfileField(params.platformBaseline.resolution)
      : undefined;

  const duration = stored?.duration
    ? cloneGenerationProfileField(stored.duration)
    : params.platformBaseline.duration
      ? cloneGenerationProfileField(params.platformBaseline.duration)
      : undefined;

  return {
    supportsTaskCancel:
      stored?.supportsTaskCancel ?? params.platformBaseline.supportsTaskCancel,
    maxReferenceImages:
      stored?.maxReferenceImages ?? params.platformBaseline.maxReferenceImages,
    maxReferenceVideos:
      stored?.maxReferenceVideos ?? params.platformBaseline.maxReferenceVideos,
    maxReferenceAudios:
      stored?.maxReferenceAudios ?? params.platformBaseline.maxReferenceAudios,
    ...(resolution ? { resolution } : {}),
    ...(duration ? { duration } : {}),
  };
}

export function isCapabilityLimitsSubsetOfPlatform(params: {
  readonly platformRules: VideoModelParameterRules;
  readonly capabilityLimits: SingleModelCapabilityLimits;
}): boolean {
  const platformRules = normalizeVideoModelParameterRules(params.platformRules);
  const platformBaseline = buildPlatformVideoCapabilityBaseline({
    rules: platformRules,
  });
  const platformAllows = platformBaseline.supportsTaskCancel;

  if (
    params.capabilityLimits.supportsTaskCancel === true &&
    !platformAllows
  ) {
    return false;
  }

  const migrated = normalizeStoredCapabilityLimits(params.capabilityLimits, {
    resolution: platformBaseline.resolution,
  });

  if (migrated.maxReferenceImages !== undefined) {
    if (
      migrated.maxReferenceImages < 0 ||
      migrated.maxReferenceImages > platformBaseline.maxReferenceImages
    ) {
      return false;
    }
  }

  if (migrated.maxReferenceVideos !== undefined) {
    if (
      migrated.maxReferenceVideos < 0 ||
      migrated.maxReferenceVideos > platformBaseline.maxReferenceVideos
    ) {
      return false;
    }
  }

  if (migrated.maxReferenceAudios !== undefined) {
    if (
      migrated.maxReferenceAudios < 0 ||
      migrated.maxReferenceAudios > platformBaseline.maxReferenceAudios
    ) {
      return false;
    }
  }

  if (migrated.resolution) {
    if (!platformBaseline.resolution) {
      return false;
    }
    if (
      !isGenerationProfileFieldSubset({
        orgField: migrated.resolution,
        platformField: platformBaseline.resolution,
      })
    ) {
      return false;
    }
  }

  if (migrated.duration) {
    if (!platformBaseline.duration) {
      return false;
    }
    if (
      !isGenerationProfileFieldSubset({
        orgField: migrated.duration,
        platformField: platformBaseline.duration,
      })
    ) {
      return false;
    }
  }

  return true;
}
