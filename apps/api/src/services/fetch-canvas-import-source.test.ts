import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CANVAS_IMPORT_SOURCE_MAX_CHARS,
  fetchCanvasImportSource,
  parseCanvasImportSourceUrl,
} from "./fetch-canvas-import-source";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseCanvasImportSourceUrl", () => {
  it("accepts http and https", () => {
    expect(parseCanvasImportSourceUrl("https://xj.quantv.com/api/canvas/public/featured/abc")).toEqual(
      new URL("https://xj.quantv.com/api/canvas/public/featured/abc")
    );
    expect(parseCanvasImportSourceUrl("file:///etc/passwd")).toEqual({
      error: "只支持 http 或 https",
    });
    expect(parseCanvasImportSourceUrl("not-a-url")).toEqual({
      error: "无效的地址",
    });
  });
});

describe("fetchCanvasImportSource", () => {
  it("returns parsed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ title: "色卡", graph: "{}" }), {
          status: 200,
        })
      )
    );
    await expect(
      fetchCanvasImportSource("https://example.com/canvas.json")
    ).resolves.toEqual({
      ok: true,
      document: { title: "色卡", graph: "{}" },
    });
  });

  it("rejects oversized payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x".repeat(CANVAS_IMPORT_SOURCE_MAX_CHARS + 1), { status: 200 }))
    );
    await expect(
      fetchCanvasImportSource("https://example.com/canvas.json")
    ).resolves.toEqual({ ok: false, error: "内容太大", status: 400 });
  });
});
