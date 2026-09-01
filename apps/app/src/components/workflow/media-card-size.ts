export interface MediaCardSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Layout snaps node positions to 12px.
 * Card height uses 24px so the vertical midpoint also sits on that grid.
 */
export const MEDIA_CARD_WIDTH_GRID_PX = 12;
export const MEDIA_CARD_HEIGHT_GRID_PX = 24;

/** Shared short side for image/video cards with media. */
export const MEDIA_CARD_SHORT_SIDE_PX = 264;

/** Cap on the long side (3:1 max). */
export const MEDIA_CARD_MAX_LONG_SIDE_PX = MEDIA_CARD_SHORT_SIDE_PX * 3;

function snapToGrid(value: number, grid: number): number {
  return Math.max(grid, Math.round(value / grid) * grid);
}

function snapCardSize(width: number, height: number): MediaCardSize {
  return {
    width: snapToGrid(width, MEDIA_CARD_WIDTH_GRID_PX),
    height: snapToGrid(height, MEDIA_CARD_HEIGHT_GRID_PX),
  };
}

/** Align a saved or measured card size to the layout grid. */
export function snapMediaCardSize(size: MediaCardSize): MediaCardSize {
  return snapCardSize(size.width, size.height);
}

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
    return snapCardSize(MEDIA_CARD_SHORT_SIDE_PX, MEDIA_CARD_SHORT_SIDE_PX);
  }

  const short = MEDIA_CARD_SHORT_SIDE_PX;
  const maxLong = MEDIA_CARD_MAX_LONG_SIDE_PX;

  if (naturalWidth >= naturalHeight) {
    return snapCardSize(
      Math.min(Math.round((naturalWidth / naturalHeight) * short), maxLong),
      short
    );
  }

  return snapCardSize(
    short,
    Math.min(Math.round((naturalHeight / naturalWidth) * short), maxLong)
  );
}

/** Image empty / generating placeholder. */
export const AI_IMAGE_EMPTY_CARD_SIZE: MediaCardSize = snapCardSize(
  MEDIA_CARD_SHORT_SIDE_PX,
  MEDIA_CARD_SHORT_SIDE_PX
);

/** Video empty / generating placeholder — 16:9 on the short side. */
export const AI_VIDEO_EMPTY_CARD_SIZE: MediaCardSize = computeMediaCardSize(
  16,
  9
);
