import type { MediaDisplaySize } from "@/services/media-display-size";

/** Must match MEDIA_CARD_SHORT_SIDE_PX in media-card-size. */
const CARD_SHORT_SIDE_PX = 270;

/** Canvas cover tiers by short-edge thumbnail size. */
export type CanvasMediaTier = "s" | "m" | "l";

/** Short-edge pixel sizes for generated thumbs. */
export const CANVAS_TIER_SHORT_EDGE: Readonly<Record<CanvasMediaTier, number>> = {
  s: 80,
  m: 270,
  l: 540,
} as const;

/** Pre-80 canvas-s thumbs still readable from IndexedDB. */
export const LEGACY_CANVAS_S_THUMB_WIDTH = 50 as const;

/** @deprecated Use CANVAS_TIER_SHORT_EDGE. */
export const CANVAS_TIER_MAX_WIDTH = CANVAS_TIER_SHORT_EDGE;

/** Screen size / card short side (270). */
export const CANVAS_TIER_RATIO = {
  s: 0.35,
  m: 1.1,
} as const;

/** Skip loading when on-screen edge is smaller than this. */
export const CANVAS_MEDIA_MIN_DISPLAY_PX = 40;

export function computeCanvasScreenShortEdge(
  viewportZoom: number,
  devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio : 1
): number {
  const safeZoom =
    Number.isFinite(viewportZoom) && viewportZoom > 0 ? viewportZoom : 1;
  const safeDpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return CARD_SHORT_SIDE_PX * safeZoom * safeDpr;
}

/** @deprecated Use computeCanvasScreenShortEdge. */
export function computeCanvasDisplayPixels(
  _cardWidthPx: number,
  viewportZoom: number,
  devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio : 1
): number {
  return computeCanvasScreenShortEdge(viewportZoom, devicePixelRatio);
}

export const CANVAS_TIER_HYSTERESIS_RATIO = 0.05;

export function pickCanvasMediaTier(screenShortEdge: number): CanvasMediaTier {
  const ratio = screenShortEdge / CARD_SHORT_SIDE_PX;
  if (!Number.isFinite(ratio) || ratio < CANVAS_TIER_RATIO.s) {
    return "s";
  }
  if (ratio < CANVAS_TIER_RATIO.m) {
    return "m";
  }
  return "l";
}

/** Reduce tier churn while zooming. */
export function pickCanvasMediaTierWithHysteresis(
  screenShortEdge: number,
  currentTier: CanvasMediaTier
): CanvasMediaTier {
  const target = pickCanvasMediaTier(screenShortEdge);
  if (target === currentTier) {
    return currentTier;
  }

  const ratio = screenShortEdge / CARD_SHORT_SIDE_PX;
  const h = CANVAS_TIER_HYSTERESIS_RATIO;

  if (currentTier === "s") {
    return ratio > CANVAS_TIER_RATIO.s + h ? target : "s";
  }

  if (currentTier === "m") {
    if (target === "s") {
      return ratio < CANVAS_TIER_RATIO.s - h ? "s" : "m";
    }
    return ratio > CANVAS_TIER_RATIO.m + h ? "l" : "m";
  }

  if (target === "l") {
    return "l";
  }
  if (target === "m") {
    return ratio < CANVAS_TIER_RATIO.m - h ? "m" : "l";
  }
  return ratio < CANVAS_TIER_RATIO.s - h ? "s" : "l";
}

export function canvasTierToDisplaySize(tier: CanvasMediaTier): MediaDisplaySize {
  if (tier === "s") return "canvas-s";
  if (tier === "m") return "canvas-m";
  return "canvas-l";
}

export function displaySizeToMaxWidth(size: MediaDisplaySize): number | null {
  if (size === "canvas-s" || size === "thumb") return CANVAS_TIER_SHORT_EDGE.s;
  if (size === "canvas-m") return CANVAS_TIER_SHORT_EDGE.m;
  if (size === "canvas-l") return CANVAS_TIER_SHORT_EDGE.l;
  return null;
}
