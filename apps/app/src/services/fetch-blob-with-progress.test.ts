import { describe, expect, it, vi } from "vitest";

import { fetchBlobWithProgress } from "@/services/fetch-blob-with-progress";

function buildProgressResponse(params: {
  readonly totalBytes: number;
  readonly chunkSize: number;
  readonly includeContentLength?: boolean;
}): Response {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < params.totalBytes; offset += params.chunkSize) {
    const size = Math.min(params.chunkSize, params.totalBytes - offset);
    chunks.push(new Uint8Array(size).fill(1));
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  const headers = new Headers({ "Content-Type": "image/png" });
  if (params.includeContentLength !== false) {
    headers.set("Content-Length", String(params.totalBytes));
  }

  return new Response(stream, { status: 200, headers });
}

describe("fetchBlobWithProgress", () => {
  it("reports download percent when Content-Length is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        buildProgressResponse({ totalBytes: 100, chunkSize: 25 })
      )
    );

    const progress: number[] = [];
    const blob = await fetchBlobWithProgress(
      "https://example.com/image.png",
      {},
      (percent) => {
        progress.push(percent);
      }
    );

    expect(blob.size).toBe(100);
    expect(progress.at(-1)).toBe(100);
    expect(progress.some((value) => value >= 25)).toBe(true);

    vi.unstubAllGlobals();
  });

  it("falls back to blob() without progress when Content-Length is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        buildProgressResponse({
          totalBytes: 64,
          chunkSize: 32,
          includeContentLength: false,
        })
      )
    );

    const onProgress = vi.fn();
    const blob = await fetchBlobWithProgress(
      "https://example.com/image.png",
      {},
      onProgress
    );

    expect(blob.size).toBe(64);
    expect(onProgress).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
