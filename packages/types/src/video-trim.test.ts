import { describe, expect, it } from "vitest";

import {
  applyVideoTrimTimeFieldEdit,
  clampVideoTrimRange,
  createDefaultVideoTrimRange,
  formatVideoTrimTimeSec,
  parseVideoTrimTimeInput,
  snapVideoTrimSec,
  VIDEO_TRIM_MIN_DURATION_SEC,
  shouldWarnVideoTrimShortDuration,
  videoTrimSelectionDurationSec,
} from "./video-trim";

describe("video-trim", () => {
  it("creates a default range within the video duration", () => {
    expect(createDefaultVideoTrimRange(30)).toEqual({ startSec: 0, endSec: 2 });
    expect(createDefaultVideoTrimRange(1.5)).toEqual({ startSec: 0, endSec: 1.5 });
    expect(createDefaultVideoTrimRange(0.05)).toEqual({
      startSec: 0,
      endSec: VIDEO_TRIM_MIN_DURATION_SEC,
    });
  });

  it("snaps to 0.1 second steps", () => {
    expect(snapVideoTrimSec(1.04)).toBe(1);
    expect(snapVideoTrimSec(1.05)).toBe(1.1);
  });

  it("clamps ranges to minimum selection duration", () => {
    expect(
      clampVideoTrimRange({ startSec: 9.95, endSec: 10 }, 10)
    ).toEqual({ startSec: 9.9, endSec: 10 });
  });

  it("applies start edits while keeping end fixed", () => {
    const next = applyVideoTrimTimeFieldEdit({
      range: { startSec: 0, endSec: 5 },
      field: "start",
      valueSec: 2,
      videoDurationSec: 10,
    });
    expect(next).toEqual({ startSec: 2, endSec: 5 });
    expect(videoTrimSelectionDurationSec(next)).toBe(3);
  });

  it("applies end edits while keeping start fixed", () => {
    const next = applyVideoTrimTimeFieldEdit({
      range: { startSec: 2, endSec: 5 },
      field: "end",
      valueSec: 8,
      videoDurationSec: 10,
    });
    expect(next).toEqual({ startSec: 2, endSec: 8 });
  });

  it("applies duration edits while keeping start fixed", () => {
    const next = applyVideoTrimTimeFieldEdit({
      range: { startSec: 1, endSec: 5 },
      field: "duration",
      valueSec: 3,
      videoDurationSec: 10,
    });
    expect(next).toEqual({ startSec: 1, endSec: 4 });
  });

  it("formats and parses time strings", () => {
    expect(formatVideoTrimTimeSec(1.23)).toBe("1.2");
    expect(parseVideoTrimTimeInput("2.5")).toBe(2.5);
    expect(parseVideoTrimTimeInput("bad")).toBeNull();
  });

  it("warns when trim selection is shorter than seedance reference minimum", () => {
    expect(shouldWarnVideoTrimShortDuration(1.9)).toBe(true);
    expect(shouldWarnVideoTrimShortDuration(2)).toBe(false);
    expect(shouldWarnVideoTrimShortDuration(3)).toBe(false);
  });
});
