import { describe, expect, it } from "vitest";

import {
  clearGenerativeProgress,
  formatGenerativeBusyOverlayLabel,
  formatGenerativePhaseLabel,
  formatGenerativeProgressElapsed,
  isClientUpstreamQueued,
  isGenerativePersistPhase,
  isGenerativePhaseCancellable,
  isGenerativeCardBusyPhase,
  isVideoStopButtonVisible,
  readClientUpstreamPollPhase,
  readGenerativeDownloadPercent,
  readGenerativeProgressJobId,
  readGenerativeProgressPhase,
  readGenerativeProgressStartedAt,
  readGenerativeStagingMediaIds,
  snapshotGenerativeProgressForPersist,
  withGenerativeProgress,
  withGenerativeTrimmingProgress,
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
    expect(readGenerativeDownloadPercent(cleared)).toBeUndefined();
  });

  it("stores and clears download percent during downloading", () => {
    const withPercent = withGenerativeProgress(undefined, {
      phase: "downloading",
      downloadPercent: 42,
    });
    expect(readGenerativeDownloadPercent(withPercent)).toBe(42);

    const uploading = withGenerativeProgress(withPercent, { phase: "uploading" });
    expect(readGenerativeDownloadPercent(uploading)).toBeUndefined();

    const clearedPercent = withGenerativeProgress(withPercent, {
      downloadPercent: null,
    });
    expect(readGenerativeDownloadPercent(clearedPercent)).toBeUndefined();
  });

  it("formats downloading labels with percent when available", () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      if (key.endsWith("Percent")) {
        return `${values?.percent ?? ""}%`;
      }
      return key;
    };

    expect(
      formatGenerativePhaseLabel({
        phase: "downloading",
        progressKey: "workflow.aiImagePanel.cardDownloading",
        metadata: { genDownloadPercent: "37" },
        t,
      })
    ).toBe("37%");

    expect(
      formatGenerativePhaseLabel({
        phase: "downloading",
        progressKey: "workflow.aiImagePanel.cardDownloading",
        metadata: undefined,
        t,
      })
    ).toBe("workflow.aiImagePanel.cardDownloading");
  });

  it("shows download percent without elapsed time in busy overlay", () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      if (key.endsWith("Percent")) {
        return `downloading ${values?.percent ?? ""}%`;
      }
      if (key.endsWith("progressWithElapsed")) {
        return `${values?.label} · ${values?.elapsed}`;
      }
      return key;
    };

    expect(
      formatGenerativeBusyOverlayLabel({
        phase: "downloading",
        progressButtonKey: () => "workflow.aiImagePanel.persistDownloading",
        i18nPrefix: "workflow.aiImagePanel",
        metadata: {
          genDownloadPercent: "55",
          genProgressStartedAt: "1",
        },
        progressNowMs: 60_000,
        t,
      })
    ).toBe("downloading 55%");
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

  it("tracks client upstream poll phase in metadata", () => {
    const queued = withGenerativeProgress(undefined, { phase: "queued" });
    expect(readClientUpstreamPollPhase(queued)).toBe("queued");
    expect(isClientUpstreamQueued(queued)).toBe(true);

    const generating = withGenerativeProgress(queued, { phase: "generating" });
    expect(readClientUpstreamPollPhase(generating)).toBe("running");
    expect(isClientUpstreamQueued(generating)).toBe(false);

    const cleared = clearGenerativeProgress(generating);
    expect(readClientUpstreamPollPhase(cleared)).toBeUndefined();
  });

  it("shows video stop button only when upstream poll reports queued", () => {
    const runningMetadata = withGenerativeProgress(undefined, {
      phase: "generating",
    });
    expect(
      isVideoStopButtonVisible({
        metadata: runningMetadata,
        overlayPhase: "generating",
        supportsTaskCancel: true,
      })
    ).toBe(false);

    const queuedMetadata = withGenerativeProgress(undefined, { phase: "queued" });
    expect(
      isVideoStopButtonVisible({
        metadata: queuedMetadata,
        overlayPhase: "generating",
        supportsTaskCancel: true,
      })
    ).toBe(true);

    expect(
      isVideoStopButtonVisible({
        metadata: withGenerativeProgress(undefined, { phase: "cancelling" }),
        overlayPhase: "generating",
        supportsTaskCancel: true,
      })
    ).toBe(false);

    expect(
      isVideoStopButtonVisible({
        metadata: queuedMetadata,
        overlayPhase: "generating",
        supportsTaskCancel: false,
      })
    ).toBe(false);
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

  it("sets and clears trim progress for manual upload cards", () => {
    const trimming = withGenerativeTrimmingProgress(undefined, true);
    expect(readGenerativeProgressPhase(trimming)).toBe("trimming");
    expect(isGenerativeCardBusyPhase("trimming")).toBe(true);

    const cleared = withGenerativeTrimmingProgress(trimming, false);
    expect(readGenerativeProgressPhase(cleared)).toBeUndefined();
  });
});
