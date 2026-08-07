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
    });
  });

  it("maps cloud object to storage key id", () => {
    expect(
      mediaReferenceToCatalogInsert("org-1", {
        id: "obj-1",
        mimeType: "image/jpeg",
        storageKey: "org/wf/image/obj-1.jpg",
        storageBackend: "volcengine_tos",
      })
    ).toEqual({
      id: "org/wf/image/obj-1.jpg",
      organizationId: "org-1",
      kind: "cloud",
      mimeType: "image/jpeg",
      storageKey: "org/wf/image/obj-1.jpg",
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
    });
  });
});

describe("partitionResolvedResourceUrls", () => {
  it("partitions resolved urls by mime type", () => {
    const result = partitionResolvedResourceUrls([
      {
        resourceId: "org/wf/image/a.png",
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
