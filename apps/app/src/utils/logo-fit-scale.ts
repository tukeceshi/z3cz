const LOGO_MIN_SCALE = 0.65;

export function contentFitScale(
  available: number,
  natural: number,
  minScale = 0
): number {
  if (available <= 0 || natural <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(minScale, available / natural));
}

export function logoFitScale(available: number, natural: number): number {
  return contentFitScale(available, natural, LOGO_MIN_SCALE);
}
