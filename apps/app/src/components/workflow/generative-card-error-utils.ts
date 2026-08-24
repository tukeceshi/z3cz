import {
  ensureGenerativeCardErrorDetail,
  normalizeGenerativeCardError,
  type GenerativeCardError,
  parseGenerativeCardErrorStored,
  serializeGenerativeCardError,
} from "@dafthunk/types";

export const GENERATIVE_CARD_GENERATE_ERROR_META_KEY = "generateError" as const;

/** @deprecated Read unified key; kept for legacy persisted workflows. */
export const AI_IMAGE_GENERATE_ERROR_META_KEY = "aiImageGenerateError" as const;

/** @deprecated Read unified key; kept for legacy persisted workflows. */
export const AI_VIDEO_GENERATE_ERROR_META_KEY = "aiVideoGenerateError" as const;

const LEGACY_GENERATE_ERROR_META_KEYS = [
  AI_IMAGE_GENERATE_ERROR_META_KEY,
  AI_VIDEO_GENERATE_ERROR_META_KEY,
] as const;

function readRawGenerateErrorValue(
  metadata: Record<string, string> | undefined
): string | undefined {
  const unified = metadata?.[GENERATIVE_CARD_GENERATE_ERROR_META_KEY];
  if (typeof unified === "string" && unified.trim().length > 0) {
    return unified.trim();
  }

  for (const key of LEGACY_GENERATE_ERROR_META_KEYS) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function hasAnyGenerateErrorKey(
  metadata: Record<string, string> | undefined
): boolean {
  if (!metadata) return false;
  if (GENERATIVE_CARD_GENERATE_ERROR_META_KEY in metadata) return true;
  return LEGACY_GENERATE_ERROR_META_KEYS.some((key) => key in metadata);
}

export function readGenerativeCardError(
  metadata: Record<string, string> | undefined
): GenerativeCardError | undefined {
  const raw = readRawGenerateErrorValue(metadata);
  if (!raw) {
    return undefined;
  }

  return ensureGenerativeCardErrorDetail(
    parseGenerativeCardErrorStored(raw) ?? normalizeGenerativeCardError(raw),
    raw
  );
}

/** @deprecated Prefer readGenerativeCardError for structured display. */
export function readGenerativeCardGenerateError(
  metadata: Record<string, string> | undefined
): string | undefined {
  const error = readGenerativeCardError(metadata);
  if (!error) {
    return undefined;
  }
  return error.detail ?? error.summary;
}

function serializeGenerateErrorInput(
  error: string | GenerativeCardError
): string {
  if (typeof error === "string") {
    return serializeGenerativeCardError(normalizeGenerativeCardError(error));
  }
  return serializeGenerativeCardError(error);
}

export function withGenerativeCardGenerateError(
  metadata: Record<string, string> | undefined,
  error: string | GenerativeCardError | null | undefined
): Record<string, string> | undefined {
  if (error == null || (typeof error === "string" && !error.trim())) {
    if (!hasAnyGenerateErrorKey(metadata)) {
      return metadata;
    }

    const next = { ...(metadata ?? {}) };
    delete next[GENERATIVE_CARD_GENERATE_ERROR_META_KEY];
    for (const key of LEGACY_GENERATE_ERROR_META_KEYS) {
      delete next[key];
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }

  const next = { ...(metadata ?? {}) };
  for (const key of LEGACY_GENERATE_ERROR_META_KEYS) {
    delete next[key];
  }
  next[GENERATIVE_CARD_GENERATE_ERROR_META_KEY] = serializeGenerateErrorInput(
    error
  );
  return next;
}

/**
 * Session-only generative UI keys. Must not be saved or rehydrated — otherwise
 * a stale card error can overwrite a successful generate after remote sync.
 */
export const TRANSIENT_GENERATIVE_METADATA_KEYS = [
  GENERATIVE_CARD_GENERATE_ERROR_META_KEY,
  AI_IMAGE_GENERATE_ERROR_META_KEY,
  AI_VIDEO_GENERATE_ERROR_META_KEY,
  "aiTextGenerating",
  "aiTextStreamStarted",
  "aiTextStagingState",
  "aiImageGenerating",
  "aiVideoGenerating",
  "aiAudioGenerating",
] as const;

const IN_FLIGHT_GENERATIVE_METADATA_KEYS = [
  "aiTextGenerating",
  "aiTextStreamStarted",
  "aiImageGenerating",
  "aiVideoGenerating",
  "aiAudioGenerating",
] as const;

export function stripTransientGenerativeMetadata(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata) return undefined;

  let changed = false;
  const next = { ...metadata };
  for (const key of TRANSIENT_GENERATIVE_METADATA_KEYS) {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  }

  if (!changed) return metadata;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Keep local generating flags when a saved/remote node would otherwise clear them. */
export function preserveInFlightGenerativeMetadata(
  incoming: Record<string, string> | undefined,
  local: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!local) {
    return incoming;
  }

  let next = incoming ? { ...incoming } : {};
  let changed = false;
  for (const key of IN_FLIGHT_GENERATIVE_METADATA_KEYS) {
    const localValue = local[key];
    if (localValue === undefined) {
      continue;
    }
    if (next[key] === localValue) {
      continue;
    }
    next[key] = localValue;
    changed = true;
  }

  if (!changed) {
    return incoming;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
