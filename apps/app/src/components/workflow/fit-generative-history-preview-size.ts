export interface GenerativeHistoryPreviewSize {
  readonly width: number;
  readonly height: number;
}

export const GENERATIVE_HISTORY_PREVIEW_MAX_HEIGHT = 500;

export function fitGenerativeHistoryPreviewSize(
  maxWidth: number,
  naturalWidth: number,
  naturalHeight: number,
  maxHeight: number = GENERATIVE_HISTORY_PREVIEW_MAX_HEIGHT
): GenerativeHistoryPreviewSize | null {
  if (
    maxWidth <= 0 ||
    maxHeight <= 0 ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    1,
    maxHeight / naturalHeight,
    maxWidth / naturalWidth
  );

  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

/** Placeholder before intrinsic dimensions are known (e.g. 16:9). */
export function fitGenerativeHistoryPreviewPlaceholder(
  maxWidth: number,
  aspectRatio: number,
  maxHeight: number = GENERATIVE_HISTORY_PREVIEW_MAX_HEIGHT
): GenerativeHistoryPreviewSize | null {
  if (maxWidth <= 0 || maxHeight <= 0 || aspectRatio <= 0) {
    return null;
  }

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width, height };
}
