import { describe, expect, it } from "vitest";

import { readVideoSegmentPlaybackSeed } from "./video-trim-session-context";

describe("readVideoSegmentPlaybackSeed", () => {
  const session = {
    sourceNodeId: "node-a",
    videoDurationSec: 8,
    trimSourceVideoUrl: "https://example.com/v.mp4",
    committedRange: { startSec: 1, endSec: 5 },
    draftRange: { startSec: 1, endSec: 5 },
    loadPhase: "ready" as const,
    playbackPaused: true,
  };

  it("returns undefined when session is missing or for another node", () => {
    expect(readVideoSegmentPlaybackSeed(null, "node-a")).toBeUndefined();
    expect(readVideoSegmentPlaybackSeed(session, "node-b")).toBeUndefined();
  });

  it("copies loaded playback fields for the same node", () => {
    expect(readVideoSegmentPlaybackSeed(session, "node-a")).toEqual({
      videoDurationSec: 8,
      trimSourceVideoUrl: "https://example.com/v.mp4",
      committedRange: { startSec: 1, endSec: 5 },
      draftRange: { startSec: 1, endSec: 5 },
      loadPhase: "ready",
      playbackPaused: true,
    });
  });
});
