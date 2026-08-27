export type GenerativeProgressPhase =
  | "queued"
  | "generating"
  | "cloud_accelerating"
  | "cancelling"
  | "cancelled"
  | "downloading"
  | "uploading"
  | "server_persisting";

const GENERATIVE_JOB_ID_META_KEY = "genJobId";
const GENERATIVE_PROGRESS_PHASE_META_KEY = "genProgressPhase";
const GENERATIVE_UPSTREAM_PHASE_META_KEY = "genUpstreamPhase";
const GENERATIVE_STAGING_MEDIA_IDS_META_KEY = "genStagingMediaIds";
const GENERATIVE_PROGRESS_STARTED_AT_META_KEY = "genProgressStartedAt";
const GENERATIVE_DOWNLOAD_PERCENT_META_KEY = "genDownloadPercent";

const PROGRESS_PHASES = new Set<string>([
  "queued",
  "generating",
  "cancelling",
  "cancelled",
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

export type ClientUpstreamPollPhase = "queued" | "running";

export function readClientUpstreamPollPhase(
  metadata: Record<string, string> | undefined
): ClientUpstreamPollPhase | undefined {
  const value = metadata?.[GENERATIVE_UPSTREAM_PHASE_META_KEY];
  if (value === "queued" || value === "running") {
    return value;
  }
  return undefined;
}

export function isClientUpstreamQueued(
  metadata: Record<string, string> | undefined
): boolean {
  return readClientUpstreamPollPhase(metadata) === "queued";
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

export function readGenerativeDownloadPercent(
  metadata: Record<string, string> | undefined
): number | undefined {
  const raw = metadata?.[GENERATIVE_DOWNLOAD_PERCENT_META_KEY]?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return undefined;
  }
  return Math.round(parsed);
}

export function formatGenerativePhaseLabel(params: {
  readonly phase: GenerativeProgressPhase | null;
  readonly progressKey: string;
  readonly metadata: Record<string, string> | undefined;
  readonly t: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
}): string {
  if (params.phase === "downloading") {
    const percent = readGenerativeDownloadPercent(params.metadata);
    if (percent !== undefined) {
      return params.t(`${params.progressKey}Percent`, { percent });
    }
  }
  return params.t(params.progressKey);
}

export function withGenerativeProgress(
  metadata: Record<string, string> | undefined,
  params: {
    readonly jobId?: string | null;
    readonly phase?: GenerativeProgressPhase | null;
    readonly upstreamPhase?: ClientUpstreamPollPhase | null;
    readonly stagingMediaIds?: readonly string[] | null;
    readonly downloadPercent?: number | null;
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
    delete next[GENERATIVE_DOWNLOAD_PERCENT_META_KEY];
  } else if (params.phase) {
    next[GENERATIVE_PROGRESS_PHASE_META_KEY] = params.phase;
    if (!next[GENERATIVE_PROGRESS_STARTED_AT_META_KEY]) {
      next[GENERATIVE_PROGRESS_STARTED_AT_META_KEY] = String(Date.now());
    }
    if (params.phase !== "downloading") {
      delete next[GENERATIVE_DOWNLOAD_PERCENT_META_KEY];
    }
  }

  if (params.upstreamPhase === null) {
    delete next[GENERATIVE_UPSTREAM_PHASE_META_KEY];
  } else if (params.upstreamPhase) {
    next[GENERATIVE_UPSTREAM_PHASE_META_KEY] = params.upstreamPhase;
  } else if (params.phase === "queued") {
    next[GENERATIVE_UPSTREAM_PHASE_META_KEY] = "queued";
  } else if (params.phase === "generating") {
    next[GENERATIVE_UPSTREAM_PHASE_META_KEY] = "running";
  }

  if (params.stagingMediaIds === null) {
    delete next[GENERATIVE_STAGING_MEDIA_IDS_META_KEY];
  } else if (params.stagingMediaIds && params.stagingMediaIds.length > 0) {
    next[GENERATIVE_STAGING_MEDIA_IDS_META_KEY] = params.stagingMediaIds.join(",");
  }

  if (params.downloadPercent === null) {
    delete next[GENERATIVE_DOWNLOAD_PERCENT_META_KEY];
  } else if (params.downloadPercent !== undefined) {
    next[GENERATIVE_DOWNLOAD_PERCENT_META_KEY] = String(params.downloadPercent);
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function clearGenerativeProgress(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  return withGenerativeProgress(metadata, {
    jobId: null,
    phase: null,
    upstreamPhase: null,
    stagingMediaIds: null,
  });
}

/** Card upload progress — sync list/canvas via metadata. */
export function withGenerativeUploadProgress(
  metadata: Record<string, string> | undefined,
  uploading: boolean
): Record<string, string> | undefined {
  if (uploading) {
    return withGenerativeProgress(metadata, { phase: "uploading" });
  }

  if (readGenerativeProgressPhase(metadata) === "uploading") {
    return withGenerativeProgress(metadata, { phase: null });
  }

  return metadata;
}

export function isGenerativeProgressActive(
  metadata: Record<string, string> | undefined
): boolean {
  return Boolean(readGenerativeProgressPhase(metadata));
}

export function isGenerativePhaseCancellable(
  phase: GenerativeProgressPhase | null | undefined
): boolean {
  return phase === "queued" || phase === "generating";
}

/** Video stop button — existing UI gates plus client poll must report queued. */
export function isVideoStopButtonVisible(params: {
  readonly metadata: Record<string, string> | undefined;
  readonly overlayPhase: GenerativeProgressPhase | null | undefined;
  readonly supportsTaskCancel: boolean;
}): boolean {
  if (params.supportsTaskCancel !== true) {
    return false;
  }
  if (readGenerativeProgressPhase(params.metadata) === "cancelling") {
    return false;
  }
  return (
    isGenerativePhaseCancellable(params.overlayPhase) &&
    isClientUpstreamQueued(params.metadata)
  );
}

export function isGenerativePersistPhase(
  phase: GenerativeProgressPhase | null | undefined
): boolean {
  return (
    phase === "downloading" ||
    phase === "uploading" ||
    phase === "server_persisting"
  );
}

/** True while work is in-flight; excludes terminal cancelled feedback. */
export function isGenerativeProgressBusyPhase(
  phase: GenerativeProgressPhase | undefined
): boolean {
  return phase !== undefined && phase !== "cancelled";
}

/** Card/upload busy — includes JSON-derived cloud acceleration. */
export function isGenerativeCardBusyPhase(
  phase: GenerativeProgressPhase | null | undefined
): boolean {
  return (
    phase === "generating" ||
    phase === "cloud_accelerating" ||
    phase === "queued" ||
    phase === "cancelling" ||
    isGenerativePersistPhase(phase) ||
    phase === "server_persisting"
  );
}

/** Persist immediately when job id or staged blob ids change (refresh resume). */
export function snapshotGenerativeProgressForPersist(
  nodes: readonly {
    readonly id: string;
    readonly data: {
      readonly metadata?: Record<string, string>;
      readonly inputs?: readonly { readonly value?: unknown }[];
    };
  }[]
): string {
  return JSON.stringify(
    nodes.map((node) => ({
      id: node.id,
      jobId: node.data.metadata?.[GENERATIVE_JOB_ID_META_KEY] ?? null,
      phase: node.data.metadata?.[GENERATIVE_PROGRESS_PHASE_META_KEY] ?? null,
      stagingMediaIds:
        node.data.metadata?.[GENERATIVE_STAGING_MEDIA_IDS_META_KEY] ?? null,
      generatingResourceIds: collectGeneratingResourceIds(node.data.inputs),
      historyFingerprint: collectHistoryPersistFingerprint(node.data.inputs),
    }))
  );
}

function collectGeneratingResourceIds(
  inputs: readonly { readonly value?: unknown }[] | undefined
): readonly string[] {
  if (!inputs) {
    return [];
  }
  const ids: string[] = [];
  for (const input of inputs) {
    collectGeneratingResourceIdsFromValue(input.value, ids);
  }
  return ids;
}

function collectHistoryPersistFingerprint(
  inputs: readonly { readonly value?: unknown }[] | undefined
): readonly string[] {
  if (!inputs) {
    return [];
  }
  const keys: string[] = [];
  for (const input of inputs) {
    collectHistoryPersistFingerprintFromValue(input.value, keys);
  }
  return keys;
}

function collectHistoryPersistFingerprintFromValue(
  value: unknown,
  keys: string[]
): void {
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as {
    readonly items?: unknown;
    readonly selectedId?: unknown;
  };
  if (!Array.isArray(record.items)) {
    return;
  }
  keys.push(
    `sel:${typeof record.selectedId === "string" ? record.selectedId : ""}`
  );
  for (const item of record.items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const entry = item as {
      readonly id?: unknown;
      readonly jobId?: unknown;
      readonly invocationId?: unknown;
      readonly images?: unknown;
      readonly videos?: unknown;
      readonly audios?: unknown;
      readonly resourceId?: unknown;
    };
    const media = [entry.images, entry.videos, entry.audios];
    const resourceBits: string[] = [];
    for (const group of media) {
      if (!Array.isArray(group)) {
        continue;
      }
      for (const ref of group) {
        if (!ref || typeof ref !== "object") {
          continue;
        }
        const mediaRef = ref as {
          readonly resourceId?: unknown;
          readonly generating?: unknown;
          readonly failed?: unknown;
        };
        if (typeof mediaRef.resourceId !== "string") {
          continue;
        }
        resourceBits.push(
          `${mediaRef.resourceId}:${mediaRef.generating === true ? "g" : ""}${mediaRef.failed === true ? "f" : ""}`
        );
      }
    }
    if (typeof entry.resourceId === "string") {
      resourceBits.push(entry.resourceId);
    }
    keys.push(
      [
        typeof entry.id === "string" ? entry.id : "",
        typeof entry.jobId === "string" ? entry.jobId : "",
        typeof entry.invocationId === "string" ? entry.invocationId : "",
        resourceBits.join(","),
      ].join("|")
    );
  }
}

function collectGeneratingResourceIdsFromValue(
  value: unknown,
  ids: string[]
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectGeneratingResourceIdsFromValue(entry, ids);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as {
    readonly resourceId?: unknown;
    readonly generating?: unknown;
    readonly images?: unknown;
    readonly items?: unknown;
  };
  if (record.generating === true && typeof record.resourceId === "string") {
    ids.push(record.resourceId);
  }
  if (Array.isArray(record.images)) {
    collectGeneratingResourceIdsFromValue(record.images, ids);
  }
  if (Array.isArray(record.items)) {
    collectGeneratingResourceIdsFromValue(record.items, ids);
  }
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
  if (params.phase === "cancelling" || params.phase === "cancelled") {
    return params.t(params.progressButtonKey(params.phase));
  }

  const progressKey = params.progressButtonKey(params.phase);
  if (params.phase === "downloading") {
    const percent = readGenerativeDownloadPercent(params.metadata);
    if (percent !== undefined) {
      return params.t(`${progressKey}Percent`, { percent });
    }
  }

  const base = params.t(progressKey);
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
