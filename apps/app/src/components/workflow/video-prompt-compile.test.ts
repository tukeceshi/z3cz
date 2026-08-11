import { describe, expect, it } from "vitest";

import {
  appendVideoPromptRefToken,
  buildVideoPromptImageEdgeIndexMap,
  compileVideoPromptForSubmit,
  compiledVideoPromptLength,
  formatVideoPromptImageRef,
  hasBrokenVideoPromptRefs,
  listBrokenVideoPromptRefEdgeIds,
  stripVideoPromptRefTokenPrefix,
} from "./video-prompt-compile";

describe("formatVideoPromptImageRef", () => {
  it("uses official 图片N labels", () => {
    expect(formatVideoPromptImageRef(1)).toBe("图片1");
    expect(formatVideoPromptImageRef(3)).toBe("图片3");
  });
});

describe("buildVideoPromptImageEdgeIndexMap", () => {
  it("assigns 1-based indices to image chips only", () => {
    const map = buildVideoPromptImageEdgeIndexMap([
      { edgeId: "e-text", kind: "text" },
      { edgeId: "e-img-1", kind: "image" },
      { edgeId: "e-vid", kind: "video" },
      { edgeId: "e-img-2", kind: "image" },
    ]);
    expect(map.get("e-img-1")).toBe(1);
    expect(map.get("e-img-2")).toBe(2);
    expect(map.has("e-text")).toBe(false);
  });
});

describe("compileVideoPromptForSubmit", () => {
  const chips = [
    { edgeId: "edge-a", kind: "image" },
    { edgeId: "edge-b", kind: "image" },
  ] as const;
  const indexMap = buildVideoPromptImageEdgeIndexMap(chips);

  it("replaces tokens with 图片N by current order", () => {
    const result = compileVideoPromptForSubmit(
      "参考{{ref:edge-b}}的场景，人物来自{{ref:edge-a}}",
      indexMap
    );
    expect(result).toEqual({
      ok: true,
      prompt: "参考图片2的场景，人物来自图片1",
    });
  });

  it("reports broken refs", () => {
    const result = compileVideoPromptForSubmit("{{ref:missing}}", indexMap);
    expect(result).toEqual({
      ok: false,
      reason: "broken_ref",
      brokenEdgeIds: ["missing"],
    });
  });

  it("reindexes when connection order changes", () => {
    const reordered = buildVideoPromptImageEdgeIndexMap([
      { edgeId: "edge-b", kind: "image" },
      { edgeId: "edge-a", kind: "image" },
    ]);
    const result = compileVideoPromptForSubmit("{{ref:edge-a}}", reordered);
    expect(result).toEqual({ ok: true, prompt: "图片2" });
  });
});

describe("compiledVideoPromptLength", () => {
  it("returns null when refs are broken", () => {
    expect(compiledVideoPromptLength("{{ref:x}}", new Map())).toBeNull();
  });

  it("counts compiled prompt length not storage token width", () => {
    const map = buildVideoPromptImageEdgeIndexMap([
      { edgeId: "edge-a", kind: "image" },
    ]);
    expect(compiledVideoPromptLength("前缀{{ref:edge-a}}后缀", map)).toBe(
      "前缀图片1后缀".length
    );
  });
});

describe("hasBrokenVideoPromptRefs", () => {
  it("detects disconnected tokens", () => {
    const map = buildVideoPromptImageEdgeIndexMap([
      { edgeId: "edge-a", kind: "image" },
    ]);
    expect(hasBrokenVideoPromptRefs("ok {{ref:edge-a}}", map)).toBe(false);
    expect(hasBrokenVideoPromptRefs("bad {{ref:gone}}", map)).toBe(true);
  });
});

describe("listBrokenVideoPromptRefEdgeIds", () => {
  it("lists every missing edge id", () => {
    const map = buildVideoPromptImageEdgeIndexMap([
      { edgeId: "edge-a", kind: "image" },
    ]);
    expect(
      listBrokenVideoPromptRefEdgeIds("{{ref:a}} {{ref:b}}", map).sort()
    ).toEqual(["a", "b"]);
  });
});

describe("appendVideoPromptRefToken", () => {
  it("adds spacing before token when needed", () => {
    expect(appendVideoPromptRefToken("hello", "edge-1")).toBe(
      "hello {{ref:edge-1}}"
    );
    expect(appendVideoPromptRefToken("hello ", "edge-1")).toBe(
      "hello {{ref:edge-1}}"
    );
    expect(appendVideoPromptRefToken("", "edge-1")).toBe("{{ref:edge-1}}");
  });
});

describe("stripVideoPromptRefTokenPrefix", () => {
  it("removes trailing @ from partial mention", () => {
    expect(stripVideoPromptRefTokenPrefix("hello@")).toBe("hello");
    expect(stripVideoPromptRefTokenPrefix("hello")).toBe("hello");
  });
});
