import { describe, expect, it } from "vitest";

import {
  resolveGenerativeNodeDefaultBaseName,
  resolveGenerativeNodeDisplayName,
} from "./generative-node-naming";

describe("resolveGenerativeNodeDefaultBaseName", () => {
  const t = (key: string) => {
    const map: Record<string, string> = {
      "workflow.canvas.aiText": "文字",
      "workflow.canvas.aiImage": "图片",
      "workflow.canvas.aiVideo": "视频",
      "workflow.canvas.aiAudio": "音频",
    };
    return map[key] ?? key;
  };

  it("returns localized labels for generative types", () => {
    expect(resolveGenerativeNodeDefaultBaseName("ai-text", "Text", t)).toBe(
      "文字"
    );
    expect(resolveGenerativeNodeDefaultBaseName("ai-image", "Image", t)).toBe(
      "图片"
    );
  });

  it("returns catalog name for non-generative types", () => {
    expect(
      resolveGenerativeNodeDefaultBaseName("http-request", "HTTP Request", t)
    ).toBe("HTTP Request");
  });
});

describe("resolveGenerativeNodeDisplayName", () => {
  it("numbers generative nodes by same-type count", () => {
    const existingNodes = [
      { data: { nodeType: "ai-text" } },
      { data: { nodeType: "ai-image" } },
    ];

    expect(
      resolveGenerativeNodeDisplayName({
        nodeType: "ai-text",
        baseName: "文字",
        existingNodes,
      })
    ).toBe("文字 2");

    expect(
      resolveGenerativeNodeDisplayName({
        nodeType: "ai-image",
        baseName: "图片",
        existingNodes,
      })
    ).toBe("图片 2");
  });

  it("supports batch adds via additionalSameTypeCount", () => {
    expect(
      resolveGenerativeNodeDisplayName({
        nodeType: "ai-video",
        baseName: "视频",
        existingNodes: [],
        additionalSameTypeCount: 1,
      })
    ).toBe("视频 2");
  });

  it("returns base name unchanged for non-generative nodes", () => {
    expect(
      resolveGenerativeNodeDisplayName({
        nodeType: "http-request",
        baseName: "HTTP Request",
        existingNodes: [{ data: { nodeType: "http-request" } }],
      })
    ).toBe("HTTP Request");
  });
});
