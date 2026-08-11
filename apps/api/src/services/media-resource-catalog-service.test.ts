import { describe, expect, it } from "vitest";

import {
  mediaReferenceToCatalogInsert,
  partitionResolvedMediaResourcesByMime,
  registerRequestToCatalogInsert,
} from "./media-resource-catalog-service";
import { partitionResolvedResourceUrls } from "./resolve-resource-refs";

describe("mediaReferenceToCatalogInsert", () => {
  it("maps local media to catalog row", () => {
    expect(
      mediaReferenceToCatalogInsert("org-1", {
        kind: "local",
        mediaId: "local-1",
        mimeType: "image/png",
      })
    ).toEqual({
      id: "local-1",
      organizationId: "org-1",
      kind: "local",
      mimeType: "image/png",
      storageKey: null,
      upstreamUrl: null,
      expiresAt: null,
    });
  });

  it("maps ephemeral media to catalog row with upstream url", () => {
    expect(
      mediaReferenceToCatalogInsert("org-1", {
        kind: "ephemeral",
        mediaId: "eph-1",
        mimeType: "image/png",
        url: "https://example.com/image.png",
        expiresAt: "2026-01-01T00:00:00.000Z",
      })
    ).toEqual({
      id: "eph-1",
      organizationId: "org-1",
      kind: "ephemeral",
      mimeType: "image/png",
      storageKey: null,
      upstreamUrl: "https://example.com/image.png",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("maps cloud object to uuid id", () => {
    expect(
      mediaReferenceToCatalogInsert("org-1", {
        id: "obj-1",
        mimeType: "image/jpeg",
        storageKey: "org/wf/image/obj-1.jpg",
        storageBackend: "volcengine_tos",
      })
    ).toEqual({
      id: "obj-1",
      organizationId: "org-1",
      kind: "cloud",
      mimeType: "image/jpeg",
      storageKey: "org/wf/image/obj-1.jpg",
      upstreamUrl: null,
      expiresAt: null,
    });
  });
});

describe("registerRequestToCatalogInsert", () => {
  it("clears storage key for non-cloud kinds", () => {
    expect(
      registerRequestToCatalogInsert("org-1", {
        id: "local-1",
        kind: "local",
        mimeType: "image/png",
        storageKey: "ignored",
      })
    ).toEqual({
      id: "local-1",
      organizationId: "org-1",
      kind: "local",
      mimeType: "image/png",
      storageKey: null,
      upstreamUrl: null,
      expiresAt: null,
      contentSha256: null,
    });
  });
});

describe("partitionResolvedResourceUrls", () => {
  it("partitions resolved urls by mime type", () => {
    const result = partitionResolvedResourceUrls([
      {
        resourceId: "019fe101-6f88-736b-bdc5-49882eed0689",
        url: "https://example.com/a.png",
        mimeType: "image/png",
      },
      {
        resourceId: "org/wf/video/a.mp4",
        url: "https://example.com/a.mp4",
        mimeType: "video/mp4",
      },
      {
        resourceId: "org/wf/audio/a.mp3",
        url: "https://example.com/a.mp3",
        mimeType: "audio/mpeg",
      },
    ]);

    expect(result.referenceImageUrls).toEqual(["https://example.com/a.png"]);
    expect(result.referenceVideoUrls).toEqual(["https://example.com/a.mp4"]);
    expect(result.referenceAudioUrls).toEqual(["https://example.com/a.mp3"]);
  });
});

describe("partitionResolvedMediaResourcesByMime", () => {
  it("ignores entries without url", () => {
    const result = partitionResolvedMediaResourcesByMime([
      {
        resourceId: "local-1",
        kind: "local",
        mimeType: "image/png",
      },
      {
        resourceId: "cloud-1",
        kind: "cloud",
        mimeType: "image/png",
        url: "https://example.com/a.png",
      },
    ]);

    expect(result.referenceImageUrls).toEqual(["https://example.com/a.png"]);
  });
});
