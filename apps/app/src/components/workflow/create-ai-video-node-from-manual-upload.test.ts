import { AI_VIDEO_NODE_TYPE, isAiVideoRetakePanel } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  buildLockedRetakeCopyNode,
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

const stubCatalog = {
  type: AI_VIDEO_NODE_TYPE,
  name: "AI Video",
  icon: "video",
  inputs: [],
  outputs: [{ name: "videos", type: "json" as const }],
};

describe("buildLockedRetakeCopyNode", () => {
  it("creates a locked copy with cover video only", () => {
    const video = {
      resourceId: "res-1",
      mimeType: "video/mp4",
    };
    const node = buildLockedRetakeCopyNode({
      catalog: stubCatalog,
      nodeId: "ai-video-retake-1",
      nodeName: "镜头A-重拍",
      position: { x: 0, y: 0 },
      video,
      createObjectUrl: () => "blob:test",
    });

    expect(node.data.name).toBe("镜头A-重拍");
    expect(isAiVideoRetakePanel(node.data.metadata)).toBe(true);
    expect(node.data.inputs.find((input) => input.id === "retake_draft")?.value).toBeDefined();
    expect(node.data.inputs.find((input) => input.id === "manual_videos")?.value).toEqual([
      video,
    ]);
    expect(node.data.inputs.find((input) => input.id === "videos_history")?.value).toBeUndefined();
  });
});
