import { describe, expect, it } from "vitest";

import { resolveForwardingVideoSize } from "./forwarding-video-size";

describe("resolveForwardingVideoSize", () => {
  it("resolves size from ratio and resolution", () => {
    expect(
      resolveForwardingVideoSize({
        sourceBody: { ratio: "16:9", resolution: "720p" },
      })
    ).toBe("1280x720");
  });

  it("uses locked resolution instead of request resolution", () => {
    expect(
      resolveForwardingVideoSize({
        sourceBody: { ratio: "16:9", resolution: "2K" },
        lockedResolution: "720p",
      })
    ).toBe("1280x720");
  });

  it("returns undefined when ratio is missing", () => {
    expect(
      resolveForwardingVideoSize({
        sourceBody: { resolution: "720p" },
      })
    ).toBeUndefined();
  });
});
