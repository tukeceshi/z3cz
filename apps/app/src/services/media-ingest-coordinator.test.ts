import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  coordinateIngestCanvasMedia,
  resetMediaIngestState,
} from "./media-ingest-coordinator";

const getCachedMediaBlob = vi.fn();
const ensureGenerativeMediaCached = vi.fn();
const generateCacheResourceTiers = vi.fn();
const notifyAiMediaCacheChanged = vi.fn();

vi.mock("@/services/ai-media-cache-service", () => ({
  getCachedMediaBlob: (...args: unknown[]) => getCachedMediaBlob(...args),
  generateCacheResourceTiers: (...args: unknown[]) =>
    generateCacheResourceTiers(...args),
}));

vi.mock("@/services/ai-media-cache-events", () => ({
  notifyAiMediaCacheChanged: () => notifyAiMediaCacheChanged(),
}));

vi.mock("@/services/stage-generative-media", () => ({
  ensureGenerativeMediaCached: (...args: unknown[]) =>
    ensureGenerativeMediaCached(...args),
}));

describe("coordinateIngestCanvasMedia", () => {
  const params = {
    organizationId: "org-1",
    workflowId: "wf-1",
    media: { resourceId: "media-1", mimeType: "image/png" },
    nodeType: "ai-image" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMediaIngestState({
      organizationId: "org-1",
      workflowId: "wf-1",
      mediaId: "media-1",
    });
    getCachedMediaBlob.mockResolvedValue(null);
    ensureGenerativeMediaCached.mockResolvedValue(undefined);
    generateCacheResourceTiers.mockResolvedValue(undefined);
  });

  it("skips network ingest when IndexedDB already has the blob", async () => {
    getCachedMediaBlob.mockResolvedValue(new Blob(["cached"]));

    await coordinateIngestCanvasMedia(params);

    expect(ensureGenerativeMediaCached).not.toHaveBeenCalled();
    expect(generateCacheResourceTiers).toHaveBeenCalledTimes(1);
    expect(notifyAiMediaCacheChanged).toHaveBeenCalledTimes(1);
  });

  it("awaits a single in-flight ingest for the same media id", async () => {
    let resolveIngest: (() => void) | undefined;
    ensureGenerativeMediaCached.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveIngest = resolve;
        })
    );
    getCachedMediaBlob
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Blob(["fresh"]));

    const first = coordinateIngestCanvasMedia(params);
    const second = coordinateIngestCanvasMedia(params);

    resolveIngest?.();
    await Promise.all([first, second]);

    expect(ensureGenerativeMediaCached).toHaveBeenCalledTimes(1);
  });
});
