export const NODE_LAYOUT_WIDTH_META_KEY = "layoutWidth" as const;
export const NODE_LAYOUT_HEIGHT_META_KEY = "layoutHeight" as const;

export interface NodeLayoutSize {
  readonly width: number;
  readonly height: number;
}

/** Called after AI staging writes a blob — persists card size into workflow JSON. */
export type PatchNodeLayoutMetadata = (layout: NodeLayoutSize) => void;

export function readNodeLayoutFromMetadata(
  metadata?: Readonly<Record<string, string>>
): NodeLayoutSize | null {
  if (!metadata) {
    return null;
  }

  const width = Number(metadata[NODE_LAYOUT_WIDTH_META_KEY]);
  const height = Number(metadata[NODE_LAYOUT_HEIGHT_META_KEY]);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { width, height };
}

/** Landscape card layout — short side is height (same rule as computeMediaCardSize). */
export function isWideLayoutSize(layout: NodeLayoutSize): boolean {
  return layout.width > layout.height;
}

export function nodeLayoutMetadataEntries(
  layout: NodeLayoutSize
): Record<string, string> {
  return {
    [NODE_LAYOUT_WIDTH_META_KEY]: String(Math.round(layout.width)),
    [NODE_LAYOUT_HEIGHT_META_KEY]: String(Math.round(layout.height)),
  };
}
