export type GenerativeProgressPhase =
  | "generating"
  | "downloading"
  | "uploading"
  | "server_persisting";

const GENERATIVE_JOB_ID_META_KEY = "genJobId";
const GENERATIVE_PROGRESS_PHASE_META_KEY = "genProgressPhase";
const GENERATIVE_STAGING_MEDIA_IDS_META_KEY = "genStagingMediaIds";

export function readGenerativeProgressJobId(
  metadata: Record<string, string> | undefined
): string | undefined {
  const value = metadata?.[GENERATIVE_JOB_ID_META_KEY]?.trim();
  return value || undefined;
}

export function readGenerativeProgressPhase(
  metadata: Record<string, string> | undefined
): GenerativeProgressPhase | undefined {
  const value = metadata?.[GENERATIVE_PROGRESS_PHASE_META_KEY];
  if (
    value === "generating" ||
    value === "downloading" ||
    value === "uploading" ||
    value === "server_persisting"
  ) {
    return value;
  }
  return undefined;
}

export function readGenerativeStagingMediaIds(
  metadata: Record<string, string> | undefined
): readonly string[] {
  const raw = metadata?.[GENERATIVE_STAGING_MEDIA_IDS_META_KEY]?.trim();
  if (!raw) {
    return [];
  }
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function withGenerativeProgress(
  metadata: Record<string, string> | undefined,
  params: {
    readonly jobId?: string | null;
    readonly phase?: GenerativeProgressPhase | null;
    readonly stagingMediaIds?: readonly string[] | null;
  }
): Record<string, string> | undefined {
  const next = { ...(metadata ?? {}) };

  if (params.jobId === null) {
    delete next[GENERATIVE_JOB_ID_META_KEY];
  } else if (params.jobId) {
    next[GENERATIVE_JOB_ID_META_KEY] = params.jobId;
  }

  if (params.phase === null) {
    delete next[GENERATIVE_PROGRESS_PHASE_META_KEY];
  } else if (params.phase) {
    next[GENERATIVE_PROGRESS_PHASE_META_KEY] = params.phase;
  }

  if (params.stagingMediaIds === null) {
    delete next[GENERATIVE_STAGING_MEDIA_IDS_META_KEY];
  } else if (params.stagingMediaIds && params.stagingMediaIds.length > 0) {
    next[GENERATIVE_STAGING_MEDIA_IDS_META_KEY] = params.stagingMediaIds.join(",");
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function clearGenerativeProgress(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  return withGenerativeProgress(metadata, {
    jobId: null,
    phase: null,
    stagingMediaIds: null,
  });
}

export function isGenerativeProgressActive(
  metadata: Record<string, string> | undefined
): boolean {
  return Boolean(readGenerativeProgressPhase(metadata));
}
