import { describe, expect, it } from "vitest";

import {
  clearGenerativeProgress,
  formatGenerativeProgressElapsed,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
  readGenerativeProgressStartedAt,
  readGenerativeStagingMediaIds,
  withGenerativeProgress,
} from "@/components/workflow/generative-progress-utils";

describe("generative-progress-utils", () => {
  it("stores and clears job progress metadata", () => {
    const withProgress = withGenerativeProgress(undefined, {
      jobId: "job-1",
      phase: "downloading",
      stagingMediaIds: ["media-1", "media-2"],
    });

    expect(readGenerativeProgressJobId(withProgress)).toBe("job-1");
    expect(readGenerativeProgressPhase(withProgress)).toBe("downloading");
    expect(readGenerativeStagingMediaIds(withProgress)).toEqual([
      "media-1",
      "media-2",
    ]);
    expect(readGenerativeProgressStartedAt(withProgress)).toEqual(
      expect.any(Number)
    );

    const cleared = clearGenerativeProgress(withProgress);
    expect(readGenerativeProgressJobId(cleared)).toBeUndefined();
    expect(readGenerativeProgressPhase(cleared)).toBeUndefined();
    expect(readGenerativeProgressStartedAt(cleared)).toBeUndefined();
    expect(readGenerativeStagingMediaIds(cleared)).toEqual([]);
  });

  it("preserves startedAt across phase updates", () => {
    const first = withGenerativeProgress(undefined, { phase: "queued" });
    const startedAt = readGenerativeProgressStartedAt(first);
    const next = withGenerativeProgress(first, { phase: "generating" });
    expect(readGenerativeProgressPhase(next)).toBe("generating");
    expect(readGenerativeProgressStartedAt(next)).toBe(startedAt);
  });

  it("formats elapsed minutes and seconds", () => {
    expect(
      formatGenerativeProgressElapsed(1_000, 1_000 + 200_000)
    ).toEqual({ minutes: 3, seconds: 20 });
  });
});
