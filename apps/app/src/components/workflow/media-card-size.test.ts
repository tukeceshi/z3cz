import { describe, expect, it } from "vitest";

import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  MEDIA_CARD_MAX_LONG_SIDE_PX,
  MEDIA_CARD_SHORT_SIDE_PX,
} from "./media-card-size";

describe("computeMediaCardSize", () => {
  it("returns square for invalid sizes", () => {
    expect(computeMediaCardSize(0, 0)).toEqual({
      width: MEDIA_CARD_SHORT_SIDE_PX,
      height: MEDIA_CARD_SHORT_SIDE_PX,
    });
  });

  it("keeps 1:1 as short square", () => {
    expect(computeMediaCardSize(1024, 1024)).toEqual({
      width: 270,
      height: 270,
    });
  });

  it("sizes 16:9 like the legacy video card", () => {
    expect(computeMediaCardSize(1920, 1080)).toEqual({
      width: 480,
      height: 270,
    });
  });

  it("sizes 9:16 portrait", () => {
    expect(computeMediaCardSize(1080, 1920)).toEqual({
      width: 270,
      height: 480,
    });
  });

  it("caps the long side", () => {
    expect(computeMediaCardSize(4000, 1000)).toEqual({
      width: MEDIA_CARD_MAX_LONG_SIDE_PX,
      height: MEDIA_CARD_SHORT_SIDE_PX,
    });
    expect(computeMediaCardSize(1000, 4000)).toEqual({
      width: MEDIA_CARD_SHORT_SIDE_PX,
      height: MEDIA_CARD_MAX_LONG_SIDE_PX,
    });
  });
});

describe("empty card sizes", () => {
  it("uses square empty image and 16:9 empty video", () => {
    expect(AI_IMAGE_EMPTY_CARD_SIZE).toEqual({ width: 270, height: 270 });
    expect(AI_VIDEO_EMPTY_CARD_SIZE).toEqual({ width: 480, height: 270 });
  });
});
