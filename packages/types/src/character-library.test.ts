import { describe, expect, it } from "vitest";

import {
  CHARACTER_LIBRARY_ASSET_ID_META_KEY,
  CHARACTER_LIBRARY_NODE_META_KEY,
  characterLibraryCategoryFromMime,
  characterLibraryCharacterCover,
  characterLibraryCharacterFromPublicGroup,
  characterLibraryEntryCategory,
  characterLibraryEntryFromPublicPortrait,
  characterLibraryEntryWorkflowId,
  characterLibraryReferenceFromEntry,
  isCharacterLibraryNodeMetadata,
  isPublicCharacterLibraryAssetQuery,
  normalizeCharacterLibraryAssetId,
  publicCharacterLibraryResourceId,
  readCharacterLibrarySubmitUrl,
  readPublicCharacterLibraryAssetId,
  toCharacterLibraryAssetUrl,
  withCharacterLibraryNodeMetadata,
} from "./character-library";

describe("character library submit url", () => {
  it("writes asset:// without duplicating the prefix", () => {
    expect(normalizeCharacterLibraryAssetId("asset://asset-1")).toBe("asset-1");
    expect(toCharacterLibraryAssetUrl("asset://asset-1")).toBe(
      "asset://asset-1"
    );
    expect(
      readCharacterLibrarySubmitUrl({
        source: "character_library",
        upstreamAssetId: "asset-1",
        upstreamAssetStatus: "active",
      })
    ).toBe("asset://asset-1");
  });

  it("rejects pending or unmarked catalog rows", () => {
    expect(
      readCharacterLibrarySubmitUrl({
        source: "character_library",
        upstreamAssetId: "asset-1",
        upstreamAssetStatus: "pending",
      })
    ).toBeNull();
    expect(
      readCharacterLibrarySubmitUrl({
        source: null,
        upstreamAssetId: "asset-1",
        upstreamAssetStatus: "active",
      })
    ).toBeNull();
  });
});

describe("characterLibraryReferenceFromEntry", () => {
  it("only builds a node ref when the asset is active", () => {
    expect(
      characterLibraryReferenceFromEntry({
        resourceId: "res-1",
        kind: "cloud",
        mimeType: "image/png",
        upstreamAssetId: "asset-1",
        upstreamAssetStatus: "pending",
      })
    ).toBeNull();
    expect(
      characterLibraryReferenceFromEntry({
        resourceId: "res-1",
        kind: "cloud",
        mimeType: "image/png",
        upstreamAssetId: "asset://asset-1",
        upstreamAssetStatus: "active",
      })
    ).toEqual({
      resourceId: "res-1",
      kind: "cloud",
      mimeType: "image/png",
      characterLibrary: true,
      upstreamAssetId: "asset-1",
    });
  });

  it("keeps the original preview url for public portraits", () => {
    expect(
      characterLibraryReferenceFromEntry({
        resourceId: "public:asset-1",
        kind: "cloud",
        mimeType: "image/jpeg",
        upstreamAssetId: "asset-1",
        upstreamAssetStatus: "active",
        previewUrl: "https://cdn.example/p.jpg",
      })
    ).toEqual({
      resourceId: "public:asset-1",
      kind: "cloud",
      mimeType: "image/jpeg",
      characterLibrary: true,
      upstreamAssetId: "asset-1",
      previewUrl: "https://cdn.example/p.jpg",
    });
  });
});

describe("character library node metadata", () => {
  it("marks the node and stores the asset id", () => {
    const metadata = withCharacterLibraryNodeMetadata(undefined, "asset://x");
    expect(metadata[CHARACTER_LIBRARY_NODE_META_KEY]).toBe("true");
    expect(metadata[CHARACTER_LIBRARY_ASSET_ID_META_KEY]).toBe("x");
    expect(isCharacterLibraryNodeMetadata(metadata)).toBe(true);
    expect(isCharacterLibraryNodeMetadata(undefined)).toBe(false);
  });
});

describe("character library category", () => {
  it("reads stored category or infers from mime", () => {
    expect(characterLibraryCategoryFromMime("image/png")).toBe("image");
    expect(characterLibraryCategoryFromMime("video/mp4")).toBe("video");
    expect(characterLibraryCategoryFromMime("audio/mpeg")).toBe("audio");
    expect(characterLibraryCategoryFromMime("application/pdf")).toBeNull();
    expect(
      characterLibraryEntryCategory({
        mimeType: "video/mp4",
        category: "image",
      })
    ).toBe("image");
    expect(
      characterLibraryEntryCategory({
        mimeType: "audio/wav",
        category: null,
      })
    ).toBe("audio");
  });
});

describe("characterLibraryEntryWorkflowId", () => {
  it("prefers the stored workflow, then the current canvas", () => {
    expect(
      characterLibraryEntryWorkflowId({ workflowId: "wf-a" }, "wf-canvas")
    ).toBe("wf-a");
    expect(
      characterLibraryEntryWorkflowId({ workflowId: null }, "wf-canvas")
    ).toBe("wf-canvas");
    expect(
      characterLibraryEntryWorkflowId({ workflowId: undefined }, undefined)
    ).toBeNull();
  });
});

describe("character library character cover", () => {
  it("uses the first image or video item", () => {
    expect(
      characterLibraryCharacterCover([
        {
          resourceId: "a",
          kind: "cloud",
          mimeType: "audio/mpeg",
          modelCanonicalId: null,
          interfaceId: null,
          createdAt: "1",
        },
        {
          resourceId: "v",
          kind: "cloud",
          mimeType: "video/mp4",
          modelCanonicalId: null,
          interfaceId: null,
          createdAt: "2",
        },
      ])?.resourceId
    ).toBe("v");
    expect(
      characterLibraryCharacterCover([
        {
          resourceId: "a",
          kind: "cloud",
          mimeType: "audio/mpeg",
          modelCanonicalId: null,
          interfaceId: null,
          createdAt: "1",
        },
      ])
    ).toBeNull();
  });
});

describe("public character library portraits", () => {
  it("maps a public portrait to an insertable library entry", () => {
    const entry = characterLibraryEntryFromPublicPortrait({
      assetId: "asset://asset-9",
      imageUrl: "https://cdn.example/p.jpg",
    });
    expect(publicCharacterLibraryResourceId("asset-9")).toBe("public:asset-9");
    expect(entry).toMatchObject({
      resourceId: "public:asset-9",
      kind: "cloud",
      mimeType: "image/jpeg",
      upstreamAssetId: "asset-9",
      upstreamAssetStatus: "active",
      previewUrl: "https://cdn.example/p.jpg",
      category: "image",
    });
  });

  it("maps a public group to a character folder", () => {
    const character = characterLibraryCharacterFromPublicGroup({
      groupId: "sid-1",
      name: "青年",
      imageUrl: "https://cdn.example/a.jpg",
      items: [
        { assetId: "asset-a", imageUrl: "https://cdn.example/a.jpg" },
        { assetId: "asset-b", imageUrl: "https://cdn.example/b.jpg" },
      ],
    });
    expect(character.id).toBe("sid-1");
    expect(character.items).toHaveLength(2);
    expect(characterLibraryCharacterCover(character.items)?.resourceId).toBe(
      "public:asset-a"
    );
  });

  it("detects asset id search", () => {
    expect(isPublicCharacterLibraryAssetQuery("asset-20240101-abc")).toBe(true);
    expect(isPublicCharacterLibraryAssetQuery("青年")).toBe(false);
    expect(readPublicCharacterLibraryAssetId("public:asset-9")).toBe("asset-9");
    expect(readPublicCharacterLibraryAssetId("res-1")).toBeNull();
  });
});
