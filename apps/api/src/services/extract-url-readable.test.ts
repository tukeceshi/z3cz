import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractReadableFromHtml,
  extractUrlReadable,
  WEB_READ_SOURCE_MAX_CHARS,
} from "./extract-url-readable";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractReadableFromHtml", () => {
  it("pulls article text from a typical page", () => {
    const html = `<!doctype html><html><head><title>新闻</title></head><body>
      <article><h1>新闻</h1><p>${"正文内容。".repeat(20)}</p></article>
    </body></html>`;
    const extracted = extractReadableFromHtml(html);
    expect(extracted?.title).toContain("新闻");
    expect(extracted?.text).toContain("正文内容");
  });

  it("falls back when readability finds nothing", () => {
    const extracted = extractReadableFromHtml(
      "<html><head><title>短页</title></head><body><p>hello</p></body></html>"
    );
    expect(extracted).toEqual({ title: "短页", text: "hello" });
  });
});

describe("extractUrlReadable", () => {
  it("rejects non-http urls", async () => {
    await expect(extractUrlReadable("file:///etc/passwd")).resolves.toEqual({
      ok: false,
      error: "只支持 http 或 https",
      status: 400,
    });
  });

  it("returns extracted text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            `<html><head><title>示例</title></head><body><article><p>${"段落。".repeat(20)}</p></article></body></html>`,
            { status: 200 }
          )
      )
    );
    const result = await extractUrlReadable("https://example.com/a");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("https://example.com/a");
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it("rejects oversized payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("x".repeat(WEB_READ_SOURCE_MAX_CHARS + 1), { status: 200 })
      )
    );
    await expect(extractUrlReadable("https://example.com/a")).resolves.toEqual({
      ok: false,
      error: "内容太大",
      status: 400,
    });
  });
});
