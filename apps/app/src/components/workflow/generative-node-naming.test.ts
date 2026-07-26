import { describe, expect, it } from "vitest";

import {
  formatLocalizedGenerativeNodeDisplayName,
  resolveGenerativeNodeDisplayName,
} from "./generative-node-naming";

describe("formatLocalizedGenerativeNodeDisplayName", () => {
  it("replaces stored base name with localized label while keeping suffix", () => {
    expect(
      formatLocalizedGenerativeNodeDisplayName({
        nodeType: "ai-audio",
        storedName: "Audio 2",
        localizedBaseName: "音频",
      })
    ).toBe("音频 2");
  });

  it("returns stored name for non-generative nodes", () => {
    expect(
      formatLocalizedGenerativeNodeDisplayName({
        nodeType: "http-request",
        storedName: "HTTP Request",
        localizedBaseName: "请求",
      })
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
