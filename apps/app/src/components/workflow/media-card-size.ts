export interface MediaCardSize {
  readonly width: number;
  readonly height: number;
}

/** Shared short side for image/video cards with media. */
export const MEDIA_CARD_SHORT_SIDE_PX = 270;

/** Cap on the long side (3:1 max). */
export const MEDIA_CARD_MAX_LONG_SIDE_PX = 810;

/** Image empty / generating placeholder. */
export const AI_IMAGE_EMPTY_CARD_SIZE: MediaCardSize = {
  width: MEDIA_CARD_SHORT_SIDE_PX,
  height: MEDIA_CARD_SHORT_SIDE_PX,
};

/** Video empty / generating placeholder — keep original 16:9. */
export const AI_VIDEO_EMPTY_CARD_SIZE: MediaCardSize = {
  width: 480,
  height: MEDIA_CARD_SHORT_SIDE_PX,
};

/**
 * Fit media into a card with fixed short side and capped long side.
 * Landscape: height = short, width = min(short * ratio, maxLong)
 * Portrait: width = short, height = min(short / ratio, maxLong)
 */
export function computeMediaCardSize(
  naturalWidth: number,
  naturalHeight: number
): MediaCardSize {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return {
      width: MEDIA_CARD_SHORT_SIDE_PX,
      height: MEDIA_CARD_SHORT_SIDE_PX,
    };
  }

  const short = MEDIA_CARD_SHORT_SIDE_PX;
  const maxLong = MEDIA_CARD_MAX_LONG_SIDE_PX;

  if (naturalWidth >= naturalHeight) {
    return {
      width: Math.min(Math.round((naturalWidth / naturalHeight) * short), maxLong),
      height: short,
    };
  }

  return {
    width: short,
    height: Math.min(Math.round((naturalHeight / naturalWidth) * short), maxLong),
  };
}
