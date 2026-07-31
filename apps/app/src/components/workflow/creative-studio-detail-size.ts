export interface StudioDetailSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Fit media into the container without upscaling past intrinsic pixels.
 * When natural size is omitted, only container fitting applies (placeholders).
 */
export function fitStudioDetailSize(
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
