import { describe, expect, it } from "vitest";

import {
  isAiVideoResultSiblingNodeId,
  resolveRetakeSiblingNodeName,
  resolveTrimSiblingNodeName,
} from "./create-ai-video-node-from-manual-upload";

describe("resolveTrimSiblingNodeName", () => {
  it("uses the 截取 suffix and increments on collision", () => {
    expect(
      resolveTrimSiblingNodeName({
        sourceNodeName: "镜头A",
        existingNodes: [],
      })
    ).toBe("镜头A-截取");
    expect(
      resolveTrimSiblingNodeName({
        sourceNodeName: "镜头A",
        existingNodes: [{ data: { name: "镜头A-截取" } }],
      })
    ).toBe("镜头A-截取-2");
  });
});

describe("resolveRetakeSiblingNodeName", () => {
  it("uses the 重拍 suffix and increments on collision", () => {
    expect(
      resolveRetakeSiblingNodeName({
        sourceNodeName: "镜头A",
        existingNodes: [],
      })
    ).toBe("镜头A-重拍");
    expect(
      resolveRetakeSiblingNodeName({
        sourceNodeName: "镜头A",
        existingNodes: [
          { data: { name: "镜头A-重拍" } },
          { data: { name: "镜头A-重拍-2" } },
        ],
      })
    ).toBe("镜头A-重拍-3");
  });
});

describe("isAiVideoResultSiblingNodeId", () => {
  it("matches retake and trim sibling ids only", () => {
    expect(isAiVideoResultSiblingNodeId("ai-video-retake-1788074316137")).toBe(
      true
    );
    expect(isAiVideoResultSiblingNodeId("ai-video-trim-1787909247339")).toBe(
      true
    );
    expect(isAiVideoResultSiblingNodeId("ai-video-1787908538926-tn346y")).toBe(
      false
    );
  });
});
