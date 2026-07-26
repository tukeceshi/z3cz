import { describe, expect, it } from "vitest";

import {
  clearGenerativeProgress,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
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

    const cleared = clearGenerativeProgress(withProgress);
    expect(readGenerativeProgressJobId(cleared)).toBeUndefined();
    expect(readGenerativeProgressPhase(cleared)).toBeUndefined();
    expect(readGenerativeStagingMediaIds(cleared)).toEqual([]);
  });
});
