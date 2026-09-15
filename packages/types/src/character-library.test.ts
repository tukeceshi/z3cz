import { describe, expect, it } from "vitest";

import {
  CHARACTER_LIBRARY_ASSET_ID_META_KEY,
  CHARACTER_LIBRARY_NODE_META_KEY,
  characterLibraryReferenceFromEntry,
  isCharacterLibraryNodeMetadata,
  normalizeCharacterLibraryAssetId,
  readCharacterLibrarySubmitUrl,
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
