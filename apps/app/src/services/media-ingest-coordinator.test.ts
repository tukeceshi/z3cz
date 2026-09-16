import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  coordinateIngestCanvasMedia,
  resetMediaIngestState,
} from "./media-ingest-coordinator";

const getCachedMediaBlob = vi.fn();
const cacheMediaFromUrl = vi.fn();
const ensureGenerativeMediaCached = vi.fn();
const generateCacheResourceTiers = vi.fn();
const notifyAiMediaCacheChanged = vi.fn();
const areResourcesCloudStored = vi.fn();

vi.mock("@/services/ai-media-cache-service", () => ({
  getCachedMediaBlob: (...args: unknown[]) => getCachedMediaBlob(...args),
  cacheMediaFromUrl: (...args: unknown[]) => cacheMediaFromUrl(...args),
  generateCacheResourceTiers: (...args: unknown[]) =>
    generateCacheResourceTiers(...args),
}));

vi.mock("@/services/ai-media-cache-events", () => ({
  notifyAiMediaCacheChanged: () => notifyAiMediaCacheChanged(),
}));

vi.mock("@/services/cloud-acceleration-decision", () => ({
  areResourcesCloudStored: (...args: unknown[]) =>
    areResourcesCloudStored(...args),
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
    cacheMediaFromUrl.mockResolvedValue(true);
    ensureGenerativeMediaCached.mockResolvedValue(undefined);
    generateCacheResourceTiers.mockResolvedValue(undefined);
    areResourcesCloudStored.mockResolvedValue(false);
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
    getCachedMediaBlob.mockResolvedValue(new Blob(["fresh"]));
    getCachedMediaBlob.mockResolvedValueOnce(null);
    getCachedMediaBlob.mockResolvedValueOnce(null);

    const first = coordinateIngestCanvasMedia(params);
    await vi.waitFor(() => {
      expect(ensureGenerativeMediaCached).toHaveBeenCalledTimes(1);
    });
    const second = coordinateIngestCanvasMedia(params);
    resolveIngest?.();
    await Promise.all([first, second]);

    expect(ensureGenerativeMediaCached).toHaveBeenCalledTimes(1);
  });

  it("re-ingests from cloud storage when catalog is cloud despite IndexedDB cache", async () => {
    getCachedMediaBlob.mockResolvedValue(new Blob(["ephemeral-stale"]));
    areResourcesCloudStored.mockResolvedValue(true);

    await coordinateIngestCanvasMedia(params);

    expect(ensureGenerativeMediaCached).toHaveBeenCalledTimes(1);
    expect(generateCacheResourceTiers).toHaveBeenCalledTimes(1);
  });

  it("caches public character-library portraits from preview URL without cloud lookup", async () => {
    resetMediaIngestState({
      organizationId: "org-1",
      workflowId: "wf-1",
      mediaId: "public:asset-9",
    });

    await coordinateIngestCanvasMedia({
      organizationId: "org-1",
      workflowId: "wf-1",
      media: {
        resourceId: "public:asset-9",
        mimeType: "image/jpeg",
        previewUrl: "https://cdn.example/p.jpg",
      },
      nodeType: "ai-image",
    });

    expect(ensureGenerativeMediaCached).not.toHaveBeenCalled();
    expect(areResourcesCloudStored).not.toHaveBeenCalled();
    expect(cacheMediaFromUrl).toHaveBeenCalledTimes(1);
    const cacheCall = cacheMediaFromUrl.mock.calls[0]?.[0] as {
      readonly fetchUrl?: string;
      readonly media: { readonly resourceId: string };
    };
    expect(cacheCall.media.resourceId).toBe("public:asset-9");
    expect(cacheCall.fetchUrl).toContain("platform-ai/media/proxy");
    expect(cacheCall.fetchUrl).toContain(
      encodeURIComponent("https://cdn.example/p.jpg")
    );
    expect(generateCacheResourceTiers).toHaveBeenCalledTimes(1);
    expect(notifyAiMediaCacheChanged).toHaveBeenCalledTimes(1);
  });

  it("skips public portrait fetch when IndexedDB already has the blob", async () => {
    resetMediaIngestState({
      organizationId: "org-1",
      workflowId: "wf-1",
      mediaId: "public:asset-9",
    });
    getCachedMediaBlob.mockResolvedValue(new Blob(["cached"]));

    await coordinateIngestCanvasMedia({
      organizationId: "org-1",
      workflowId: "wf-1",
      media: {
        resourceId: "public:asset-9",
        mimeType: "image/jpeg",
        previewUrl: "https://cdn.example/p.jpg",
      },
      nodeType: "ai-image",
    });

    expect(cacheMediaFromUrl).not.toHaveBeenCalled();
    expect(ensureGenerativeMediaCached).not.toHaveBeenCalled();
    expect(areResourcesCloudStored).not.toHaveBeenCalled();
    expect(generateCacheResourceTiers).toHaveBeenCalledTimes(1);
  });

  it("does not cache public portraits without a preview URL", async () => {
    resetMediaIngestState({
      organizationId: "org-1",
      workflowId: "wf-1",
      mediaId: "public:asset-9",
    });

    await coordinateIngestCanvasMedia({
      organizationId: "org-1",
      workflowId: "wf-1",
      media: {
        resourceId: "public:asset-9",
        mimeType: "image/jpeg",
      },
      nodeType: "ai-image",
    });

    expect(cacheMediaFromUrl).not.toHaveBeenCalled();
    expect(ensureGenerativeMediaCached).not.toHaveBeenCalled();
    expect(areResourcesCloudStored).not.toHaveBeenCalled();
    expect(generateCacheResourceTiers).not.toHaveBeenCalled();
  });
});
