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

export function toDurationTenths(valueSec: number): number {
  if (!Number.isFinite(valueSec)) {
    return 0;
  }
  return Math.round(snapVideoTrimSec(valueSec) / VIDEO_TRIM_SNAP_STEP_SEC);
}

export function fromDurationTenths(tenths: number): number {
  return Math.max(0, tenths) * VIDEO_TRIM_SNAP_STEP_SEC;
}

/** Round up to the nearest 0.1 s step (conservative for billing estimates). */
export function ceilDurationStepSec(valueSec: number): number {
  if (!Number.isFinite(valueSec) || valueSec <= 0) {
    return 0;
  }
  return fromDurationTenths(
    Math.ceil(valueSec / VIDEO_TRIM_SNAP_STEP_SEC - 1e-9)
  );
}

export function videoTrimSelectionDurationSec(range: VideoTrimRangeSec): number {
  const startTenths = toDurationTenths(range.startSec);
  const endTenths = toDurationTenths(range.endSec);
  return fromDurationTenths(Math.max(0, endTenths - startTenths));
}

function resolveVideoDurationSec(videoDurationSec: number): number {
  return Math.max(
    VIDEO_TRIM_MIN_DURATION_SEC,
    Number.isFinite(videoDurationSec)
      ? videoDurationSec
      : VIDEO_TRIM_MIN_DURATION_SEC
  );
}

function resolveEffectiveMinSelectionSec(
  videoDurationSec: number,
  minSelectionSec: number
): number {
  return Math.min(minSelectionSec, resolveVideoDurationSec(videoDurationSec));
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

export function createDefaultVideoRetakeTrimRange(
  videoDurationSec: number
): VideoTrimRangeSec {
  if (!Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
    return { startSec: 0, endSec: SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC };
  }

  const endSec = Math.min(
    videoDurationSec,
    Math.max(VIDEO_TRIM_MIN_DURATION_SEC, SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC)
  );
  return clampVideoRetakeTrimRange({ startSec: 0, endSec }, videoDurationSec);
}

export function clampVideoTrimRange(
  range: VideoTrimRangeSec,
  videoDurationSec: number,
  minSelectionSec: number = VIDEO_TRIM_MIN_DURATION_SEC
): VideoTrimRangeSec {
  const duration = resolveVideoDurationSec(videoDurationSec);
  const effectiveMin = resolveEffectiveMinSelectionSec(
    videoDurationSec,
    minSelectionSec
  );

  let endSec = snapVideoTrimSec(
    Math.min(duration, Math.max(effectiveMin, range.endSec))
  );
  let startSec = snapVideoTrimSec(Math.max(0, Math.min(range.startSec, endSec)));

  endSec = Math.min(duration, Math.max(effectiveMin, endSec));
  startSec = Math.max(0, Math.min(startSec, endSec));

  if (endSec - startSec < effectiveMin) {
    if (endSec >= duration) {
      startSec = Math.max(0, endSec - effectiveMin);
    } else {
      endSec = Math.min(duration, startSec + effectiveMin);
    }
  }

  return { startSec, endSec };
}

export function clampVideoRetakeTrimRange(
  range: VideoTrimRangeSec,
  videoDurationSec: number
): VideoTrimRangeSec {
  return clampVideoTrimRange(
    range,
    videoDurationSec,
    SEEDANCE_2_5_VIDEO_EDIT_MIN_SEC
  );
}

export function shiftVideoTrimRange(
  range: VideoTrimRangeSec,
  deltaSec: number,
  videoDurationSec: number,
  minSelectionSec: number = VIDEO_TRIM_MIN_DURATION_SEC
): VideoTrimRangeSec {
  const duration = resolveVideoDurationSec(videoDurationSec);
  const selectionDuration = videoTrimSelectionDurationSec(range);
  let startSec = snapVideoTrimSec(range.startSec + deltaSec);
  let endSec = startSec + selectionDuration;

  if (endSec > duration) {
    endSec = duration;
    startSec = Math.max(0, endSec - selectionDuration);
  }
  if (startSec < 0) {
    startSec = 0;
    endSec = Math.min(duration, startSec + selectionDuration);
  }

  return clampVideoTrimRange(
    { startSec, endSec },
    videoDurationSec,
    minSelectionSec
  );
}

export function applyVideoTrimTimeFieldEdit(params: {
  readonly range: VideoTrimRangeSec;
  readonly field: VideoTrimTimeField;
  readonly valueSec: number;
  readonly videoDurationSec: number;
  readonly minSelectionSec?: number;
}): VideoTrimRangeSec {
  const minSelectionSec =
    params.minSelectionSec ?? VIDEO_TRIM_MIN_DURATION_SEC;
  const duration = resolveVideoDurationSec(params.videoDurationSec);
  const effectiveMin = resolveEffectiveMinSelectionSec(
    params.videoDurationSec,
    minSelectionSec
  );
  const snapped = snapVideoTrimSec(params.valueSec);

  if (params.field === "start") {
    const endSec = params.range.endSec;
    const startSec = Math.max(0, Math.min(snapped, endSec - effectiveMin));
    return clampVideoTrimRange(
      { startSec, endSec },
      duration,
      minSelectionSec
    );
  }

  if (params.field === "end") {
    const startSec = params.range.startSec;
    const endSec = Math.min(
      duration,
      Math.max(snapped, startSec + effectiveMin)
    );
    return clampVideoTrimRange(
      { startSec, endSec },
      duration,
      minSelectionSec
    );
  }

  const startSec = params.range.startSec;
  const selectionDuration = Math.min(
    duration - startSec,
    Math.max(effectiveMin, snapped)
  );
  const endSec = startSec + selectionDuration;
  return clampVideoTrimRange({ startSec, endSec }, duration, minSelectionSec);
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

export type VideoRetakeSegmentRole = "keep" | "retake";

export interface VideoRetakeSegment {
  readonly role: VideoRetakeSegmentRole;
  readonly range: VideoTrimRangeSec;
}

export function splitVideoRetakeSegments(
  range: VideoTrimRangeSec,
  videoDurationSec: number
): readonly VideoRetakeSegment[] {
  const duration = resolveVideoDurationSec(videoDurationSec);
  const startSec = snapVideoTrimSec(Math.max(0, Math.min(range.startSec, duration)));
  const endSec = snapVideoTrimSec(
    Math.max(startSec, Math.min(range.endSec, duration))
  );

  const segments: VideoRetakeSegment[] = [];

  if (startSec >= VIDEO_TRIM_MIN_DURATION_SEC) {
    segments.push({
      role: "keep",
      range: { startSec: 0, endSec: startSec },
    });
  }

  segments.push({
    role: "retake",
    range: { startSec, endSec: Math.max(endSec, startSec + VIDEO_TRIM_MIN_DURATION_SEC) },
  });

  if (duration - endSec >= VIDEO_TRIM_MIN_DURATION_SEC) {
    segments.push({
      role: "keep",
      range: { startSec: endSec, endSec: duration },
    });
  }

  return segments;
}
