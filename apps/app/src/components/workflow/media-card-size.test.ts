import { describe, expect, it } from "vitest";

import { AI_AUDIO_CARD_HEIGHT_PX } from "./ai-audio-node-utils";
import { AI_TEXT_CARD_HEIGHT_PX } from "./ai-text-node-utils";
import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  MEDIA_CARD_HEIGHT_GRID_PX,
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
      width: MEDIA_CARD_SHORT_SIDE_PX,
      height: MEDIA_CARD_SHORT_SIDE_PX,
    });
  });

  it("sizes 16:9 to the empty video card", () => {
    expect(computeMediaCardSize(1920, 1080)).toEqual(AI_VIDEO_EMPTY_CARD_SIZE);
  });

  it("sizes 9:16 portrait with height on the layout grid", () => {
    const size = computeMediaCardSize(1080, 1920);
    expect(size.width).toBe(MEDIA_CARD_SHORT_SIDE_PX);
    expect(size.height % MEDIA_CARD_HEIGHT_GRID_PX).toBe(0);
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
  it("keeps default heights on the layout midpoint grid", () => {
    expect(AI_TEXT_CARD_HEIGHT_PX % MEDIA_CARD_HEIGHT_GRID_PX).toBe(0);
    expect(AI_AUDIO_CARD_HEIGHT_PX % MEDIA_CARD_HEIGHT_GRID_PX).toBe(0);
    expect(AI_IMAGE_EMPTY_CARD_SIZE.height % MEDIA_CARD_HEIGHT_GRID_PX).toBe(0);
    expect(AI_VIDEO_EMPTY_CARD_SIZE.height % MEDIA_CARD_HEIGHT_GRID_PX).toBe(0);
  });

  it("uses a square empty image and 16:9 empty video", () => {
    expect(AI_IMAGE_EMPTY_CARD_SIZE).toEqual({
      width: MEDIA_CARD_SHORT_SIDE_PX,
      height: MEDIA_CARD_SHORT_SIDE_PX,
    });
    expect(AI_VIDEO_EMPTY_CARD_SIZE.height).toBe(MEDIA_CARD_SHORT_SIDE_PX);
    expect(AI_VIDEO_EMPTY_CARD_SIZE.width).toBeGreaterThan(
      AI_VIDEO_EMPTY_CARD_SIZE.height
    );
  });
});
