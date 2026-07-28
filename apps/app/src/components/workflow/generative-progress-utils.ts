export type GenerativeProgressPhase =
  | "queued"
  | "generating"
  | "downloading"
  | "uploading"
  | "server_persisting";

const GENERATIVE_JOB_ID_META_KEY = "genJobId";
const GENERATIVE_PROGRESS_PHASE_META_KEY = "genProgressPhase";
const GENERATIVE_STAGING_MEDIA_IDS_META_KEY = "genStagingMediaIds";
const GENERATIVE_PROGRESS_STARTED_AT_META_KEY = "genProgressStartedAt";

const PROGRESS_PHASES = new Set<string>([
  "queued",
  "generating",
  "downloading",
  "uploading",
  "server_persisting",
]);

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
  if (value && PROGRESS_PHASES.has(value)) {
    return value as GenerativeProgressPhase;
  }
  return undefined;
}

export function readGenerativeProgressStartedAt(
  metadata: Record<string, string> | undefined
): number | undefined {
  const raw = metadata?.[GENERATIVE_PROGRESS_STARTED_AT_META_KEY]?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
    delete next[GENERATIVE_PROGRESS_STARTED_AT_META_KEY];
  } else if (params.phase) {
    next[GENERATIVE_PROGRESS_PHASE_META_KEY] = params.phase;
    if (!next[GENERATIVE_PROGRESS_STARTED_AT_META_KEY]) {
      next[GENERATIVE_PROGRESS_STARTED_AT_META_KEY] = String(Date.now());
    }
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

/** Persist immediately when job id or staged blob ids change (refresh resume). */
export function snapshotGenerativeProgressForPersist(
  nodes: readonly { readonly id: string; readonly data: { readonly metadata?: Record<string, string> } }[]
): string {
  return JSON.stringify(
    nodes.map((node) => ({
      id: node.id,
      jobId: node.data.metadata?.[GENERATIVE_JOB_ID_META_KEY] ?? null,
      phase: node.data.metadata?.[GENERATIVE_PROGRESS_PHASE_META_KEY] ?? null,
      stagingMediaIds:
        node.data.metadata?.[GENERATIVE_STAGING_MEDIA_IDS_META_KEY] ?? null,
    }))
  );
}

/** Formats elapsed generation time for progress labels (e.g. `3m 20s`). */
export function formatGenerativeBusyOverlayLabel(params: {
  readonly phase: GenerativeProgressPhase;
  readonly progressButtonKey: (phase: GenerativeProgressPhase | null) => string;
  readonly i18nPrefix:
    | "workflow.aiImagePanel"
    | "workflow.aiVideoPanel"
    | "workflow.aiAudioPanel";
  readonly metadata: Record<string, string> | undefined;
  readonly progressNowMs: number;
  readonly t: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
}): string {
  const base = params.t(params.progressButtonKey(params.phase));
  const startedAt = readGenerativeProgressStartedAt(params.metadata);
  if (!startedAt) {
    return base;
  }
  const { minutes, seconds } = formatGenerativeProgressElapsed(
    startedAt,
    params.progressNowMs
  );
  const elapsed =
    minutes > 0
      ? params.t(`${params.i18nPrefix}.progressElapsedMinutes`, {
          minutes,
          seconds: String(seconds).padStart(2, "0"),
        })
      : params.t(`${params.i18nPrefix}.progressElapsedSeconds`, { seconds });
  return params.t(`${params.i18nPrefix}.progressWithElapsed`, {
    label: base.replace(/[….]+$/u, "").trimEnd(),
    elapsed,
  });
}

/** Formats elapsed generation time for progress labels (e.g. `3m 20s`). */
export function formatGenerativeProgressElapsed(
  startedAtMs: number,
  nowMs: number = Date.now()
): { readonly minutes: number; readonly seconds: number } {
  const totalSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  return {
    minutes: Math.floor(totalSec / 60),
    seconds: totalSec % 60,
  };
}
