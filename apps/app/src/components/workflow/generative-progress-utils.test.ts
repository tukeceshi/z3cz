import { describe, expect, it } from "vitest";

import {
  clearGenerativeProgress,
  formatGenerativeProgressElapsed,
  isGenerativePersistPhase,
  isGenerativePhaseCancellable,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
  readGenerativeProgressStartedAt,
  readGenerativeStagingMediaIds,
  snapshotGenerativeProgressForPersist,
  withGenerativeProgress,
  withGenerativeUploadProgress,
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

  it("allows cancel only during queued and generating phases", () => {
    expect(isGenerativePhaseCancellable("queued")).toBe(true);
    expect(isGenerativePhaseCancellable("generating")).toBe(true);
    expect(isGenerativePhaseCancellable("cancelling")).toBe(false);
    expect(isGenerativePhaseCancellable("cancelled")).toBe(false);
    expect(isGenerativePhaseCancellable("downloading")).toBe(false);
    expect(isGenerativePhaseCancellable("uploading")).toBe(false);
    expect(isGenerativePhaseCancellable("server_persisting")).toBe(false);
    expect(isGenerativePhaseCancellable(null)).toBe(false);
  });

  it("snapshots generating resource ids from history inputs", () => {
    expect(
      snapshotGenerativeProgressForPersist([
        {
          id: "node-1",
          data: {
            metadata: { genJobId: "job-2" },
            inputs: [
              {
                value: {
                  selectedId: "gen-1",
                  items: [
                    {
                      id: "gen-1",
                      images: [
                        {
                          resourceId: "pending-1",
                          mimeType: "image/png",
                          generating: true,
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      ])
    ).toBe(
      JSON.stringify([
        {
          id: "node-1",
          jobId: "job-2",
          phase: null,
          stagingMediaIds: null,
          generatingResourceIds: ["pending-1"],
          historyFingerprint: ["sel:gen-1", "gen-1|||pending-1:g"],
        },
      ])
    );
  });

  it("treats download and upload as persist phases, not generating", () => {
    expect(isGenerativePersistPhase("downloading")).toBe(true);
    expect(isGenerativePersistPhase("uploading")).toBe(true);
    expect(isGenerativePersistPhase("server_persisting")).toBe(true);
    expect(isGenerativePersistPhase("generating")).toBe(false);
    expect(isGenerativePersistPhase("queued")).toBe(false);
  });

  it("sets and clears upload progress without touching other phases", () => {
    const uploading = withGenerativeUploadProgress(undefined, true);
    expect(readGenerativeProgressPhase(uploading)).toBe("uploading");

    const cleared = withGenerativeUploadProgress(uploading, false);
    expect(readGenerativeProgressPhase(cleared)).toBeUndefined();

    const generating = withGenerativeProgress(undefined, { phase: "generating" });
    expect(readGenerativeProgressPhase(
      withGenerativeUploadProgress(generating, false)
    )).toBe("generating");
  });
});
