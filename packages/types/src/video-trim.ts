export const VIDEO_TRIM_MIN_DURATION_SEC = 0.1 as const;
export const VIDEO_TRIM_SNAP_STEP_SEC = 0.1 as const;
export const SEEDANCE_VIDEO_REFERENCE_MIN_SEC = 2 as const;
export const SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC = 4 as const;

export function shouldWarnVideoTrimShortDuration(durationSec: number): boolean {
  return durationSec < SEEDANCE_VIDEO_REFERENCE_MIN_SEC;
}

export interface VideoTrimRangeSec {
  readonly startSec: number;
  readonly endSec: number;
}

export type VideoTrimTimeField = "start" | "end" | "duration";

export function videoTrimSelectionDurationSec(range: VideoTrimRangeSec): number {
  return Math.max(0, range.endSec - range.startSec);
}

export function snapVideoTrimSec(valueSec: number): number {
  if (!Number.isFinite(valueSec)) {
    return 0;
  }
  return (
    Math.round(valueSec / VIDEO_TRIM_SNAP_STEP_SEC) * VIDEO_TRIM_SNAP_STEP_SEC
  );
}

export function createDefaultVideoTrimRange(
  videoDurationSec: number
): VideoTrimRangeSec {
  if (!Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
    return { startSec: 0, endSec: VIDEO_TRIM_MIN_DURATION_SEC };
  }

  const endSec = Math.min(
    videoDurationSec,
    Math.max(VIDEO_TRIM_MIN_DURATION_SEC, SEEDANCE_VIDEO_REFERENCE_MIN_SEC)
  );
  return clampVideoTrimRange({ startSec: 0, endSec }, videoDurationSec);
}

export function clampVideoTrimRange(
  range: VideoTrimRangeSec,
  videoDurationSec: number
): VideoTrimRangeSec {
  const duration = Math.max(
    VIDEO_TRIM_MIN_DURATION_SEC,
    Number.isFinite(videoDurationSec) ? videoDurationSec : VIDEO_TRIM_MIN_DURATION_SEC
  );

  let endSec = snapVideoTrimSec(
    Math.min(duration, Math.max(VIDEO_TRIM_MIN_DURATION_SEC, range.endSec))
  );
  let startSec = snapVideoTrimSec(Math.max(0, Math.min(range.startSec, endSec)));

  endSec = Math.min(duration, Math.max(VIDEO_TRIM_MIN_DURATION_SEC, endSec));
  startSec = Math.max(0, Math.min(startSec, endSec));

  if (endSec - startSec < VIDEO_TRIM_MIN_DURATION_SEC) {
    if (endSec >= duration) {
      startSec = Math.max(0, endSec - VIDEO_TRIM_MIN_DURATION_SEC);
    } else {
      endSec = Math.min(duration, startSec + VIDEO_TRIM_MIN_DURATION_SEC);
    }
  }

  return { startSec, endSec };
}

export function applyVideoTrimTimeFieldEdit(params: {
  readonly range: VideoTrimRangeSec;
  readonly field: VideoTrimTimeField;
  readonly valueSec: number;
  readonly videoDurationSec: number;
}): VideoTrimRangeSec {
  const duration = Math.max(
    VIDEO_TRIM_MIN_DURATION_SEC,
    Number.isFinite(params.videoDurationSec)
      ? params.videoDurationSec
      : VIDEO_TRIM_MIN_DURATION_SEC
  );
  const snapped = snapVideoTrimSec(params.valueSec);

  if (params.field === "start") {
    const endSec = params.range.endSec;
    const startSec = Math.max(
      0,
      Math.min(snapped, endSec - VIDEO_TRIM_MIN_DURATION_SEC)
    );
    return clampVideoTrimRange({ startSec, endSec }, duration);
  }

  if (params.field === "end") {
    const startSec = params.range.startSec;
    const endSec = Math.min(
      duration,
      Math.max(snapped, startSec + VIDEO_TRIM_MIN_DURATION_SEC)
    );
    return clampVideoTrimRange({ startSec, endSec }, duration);
  }

  const startSec = params.range.startSec;
  const selectionDuration = Math.min(
    duration - startSec,
    Math.max(VIDEO_TRIM_MIN_DURATION_SEC, snapped)
  );
  const endSec = startSec + selectionDuration;
  return clampVideoTrimRange({ startSec, endSec }, duration);
}

export function formatVideoTrimTimeSec(valueSec: number): string {
  if (!Number.isFinite(valueSec) || valueSec < 0) {
    return "0.0";
  }
  return valueSec.toFixed(1);
}

export function parseVideoTrimTimeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return snapVideoTrimSec(parsed);
}
