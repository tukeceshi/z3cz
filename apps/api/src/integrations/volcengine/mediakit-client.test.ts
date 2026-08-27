import { describe, expect, it } from "vitest";

import { resolveMediaKitPollOutcome } from "./mediakit-client";

describe("resolveMediaKitPollOutcome", () => {
  it("treats completed + success:true + video_url as succeeded", () => {
    const outcome = resolveMediaKitPollOutcome(
      {
        success: true,
        task_id: "amk-tool-enhance-video-fast-1070918263042",
        status: "completed",
        result: {
          duration: 4.097,
          fps: 24,
          resolution: "1080p",
          video_url:
            "https://2131169369-amk-2100234125-default-432286.vod.cn-north-1.volcvideo.com/example?preview=1",
        },
      },
      true
    );

    expect(outcome.status).toBe("succeeded");
    expect(outcome.videoUrl).toContain("volcvideo.com");
  });

  it("treats success:true with video_url as succeeded when status is running", () => {
    const outcome = resolveMediaKitPollOutcome(
      {
        success: true,
        status: "processing",
        result: {
          video_url: "https://example.com/out.mp4",
        },
      },
      true
    );

    expect(outcome.status).toBe("succeeded");
    expect(outcome.videoUrl).toBe("https://example.com/out.mp4");
  });

  it("treats success:false as failed", () => {
    const outcome = resolveMediaKitPollOutcome(
      {
        success: false,
        status: "completed",
        message: "upstream rejected",
      },
      true
    );

    expect(outcome.status).toBe("failed");
    expect(outcome.error).toBe("upstream rejected");
  });

  it("keeps queued and running states", () => {
    expect(
      resolveMediaKitPollOutcome({ success: true, status: "queued" }, true)
        .status
    ).toBe("queued");
    expect(
      resolveMediaKitPollOutcome({ success: true, status: "running" }, true)
        .status
    ).toBe("running");
  });
});
