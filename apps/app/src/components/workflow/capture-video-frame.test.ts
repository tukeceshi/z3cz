import { describe, expect, it } from "vitest";

import {
  formatVideoFrameSuffix,
  formatVideoTime,
} from "./capture-video-frame";
import { resolveVideoFrameAiImageNodeName } from "./create-ai-image-node-from-video-frame";

describe("formatVideoTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatVideoTime(0)).toBe("0:00");
    expect(formatVideoTime(65)).toBe("1:05");
  });
});

describe("formatVideoFrameSuffix", () => {
  it("maps capture modes to node name suffixes", () => {
    expect(formatVideoFrameSuffix("first", 0)).toBe("首帧");
    expect(formatVideoFrameSuffix("last", 5)).toBe("尾帧");
    expect(formatVideoFrameSuffix("current", 2.4)).toBe("2秒帧");
  });
});

describe("resolveVideoFrameAiImageNodeName", () => {
  it("deduplicates repeated frame node names", () => {
    const existingNodes = [
      { data: { name: "视频节点 3-首帧" } },
      { data: { name: "视频节点 3-首帧-2" } },
    ];

    expect(
      resolveVideoFrameAiImageNodeName({
        sourceNodeName: "视频节点 3",
        frameSuffix: "首帧",
        existingNodes,
      })
    ).toBe("视频节点 3-首帧-3");
  });
});
