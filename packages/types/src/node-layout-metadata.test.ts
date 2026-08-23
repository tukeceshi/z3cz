import { describe, expect, it } from "vitest";

import {
  NODE_LAYOUT_HEIGHT_META_KEY,
  NODE_LAYOUT_WIDTH_META_KEY,
  nodeLayoutMetadataEntries,
  readNodeLayoutFromMetadata,
} from "./node-layout-metadata";

describe("node-layout-metadata", () => {
  it("round-trips layout through metadata entries", () => {
    const entries = nodeLayoutMetadataEntries({ width: 540, height: 270 });
    expect(entries).toEqual({
      [NODE_LAYOUT_WIDTH_META_KEY]: "540",
      [NODE_LAYOUT_HEIGHT_META_KEY]: "270",
    });
    expect(readNodeLayoutFromMetadata(entries)).toEqual({
      width: 540,
      height: 270,
    });
  });

  it("returns null for invalid metadata", () => {
    expect(readNodeLayoutFromMetadata(undefined)).toBeNull();
    expect(
      readNodeLayoutFromMetadata({
        [NODE_LAYOUT_WIDTH_META_KEY]: "0",
        [NODE_LAYOUT_HEIGHT_META_KEY]: "270",
      })
    ).toBeNull();
  });
});
