export interface StudioDetailSize {
  readonly width: number;
  readonly height: number;
}

/** Matches `STUDIO_DETAIL_MEDIA_FRAME` border width (1px each side). */
export const STUDIO_DETAIL_MEDIA_BORDER_PX = 1;

/**
 * Fit media content into the container without upscaling past intrinsic pixels.
 * When natural size is omitted, only container fitting applies (placeholders).
 */
export function fitStudioDetailContentSize(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number,
  naturalWidth?: number,
  naturalHeight?: number
): StudioDetailSize | null {
  if (containerWidth <= 0 || containerHeight <= 0 || aspectRatio <= 0) {
    return null;
  }

  let width: number;
  let height: number;

  if (aspectRatio >= 1) {
    width = containerWidth;
    height = width / aspectRatio;
    if (height > containerHeight) {
      height = containerHeight;
      width = height * aspectRatio;
    }
  } else {
    height = containerHeight;
    width = height * aspectRatio;
    if (width > containerWidth) {
      width = containerWidth;
      height = width / aspectRatio;
    }
  }

  if (
    typeof naturalWidth === "number" &&
    typeof naturalHeight === "number" &&
    naturalWidth > 0 &&
    naturalHeight > 0
  ) {
    const scale = Math.min(1, naturalWidth / width, naturalHeight / height);
    width *= scale;
    height *= scale;
  }

  return { width, height };
}

/**
 * Fits a bordered media frame into the container. Outer size includes the border so
 * the inner content box keeps the media aspect ratio (avoids object-contain letterbox).
 */
export function fitStudioDetailSize(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number,
  naturalWidth?: number,
  naturalHeight?: number,
  borderWidth: number = STUDIO_DETAIL_MEDIA_BORDER_PX
): StudioDetailSize | null {
  const innerContainerWidth = Math.max(0, containerWidth - 2 * borderWidth);
  const innerContainerHeight = Math.max(0, containerHeight - 2 * borderWidth);
  const content = fitStudioDetailContentSize(
    innerContainerWidth,
    innerContainerHeight,
    aspectRatio,
    naturalWidth,
    naturalHeight
  );
  if (!content) {
    return null;
  }

  return {
    width: content.width + 2 * borderWidth,
    height: content.height + 2 * borderWidth,
  };
}
