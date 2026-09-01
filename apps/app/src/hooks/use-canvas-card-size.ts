import { useCallback, useEffect, useRef, useState } from "react";

import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  snapMediaCardSize,
  type MediaCardSize,
} from "@/components/workflow/media-card-size";

function emptyCardSize(kind: "image" | "video"): MediaCardSize {
  return kind === "video" ? AI_VIDEO_EMPTY_CARD_SIZE : AI_IMAGE_EMPTY_CARD_SIZE;
}

function resolveStoredCardSize(
  kind: "image" | "video",
  initialLayout: MediaCardSize | null
): MediaCardSize {
  return initialLayout
    ? snapMediaCardSize(initialLayout)
    : emptyCardSize(kind);
}

function sameSize(left: MediaCardSize, right: MediaCardSize): boolean {
  return left.width === right.width && left.height === right.height;
}

interface UseCanvasCardSizeParams {
  readonly kind: "image" | "video";
  readonly hasMedia: boolean;
  readonly mediaKey: string | null;
  /** Keep the last size (e.g. while generating). */
  readonly holdSize?: boolean;
  /** Persisted layout from workflow JSON — used for first paint. */
  readonly initialLayout?: MediaCardSize | null;
  /** Write card size into node metadata so the outer card matches. */
  readonly persistLayout?: (size: MediaCardSize) => void;
}

export function useCanvasCardSize({
  kind,
  hasMedia,
  mediaKey,
  holdSize = false,
  initialLayout = null,
  persistLayout,
}: UseCanvasCardSizeParams): {
  readonly cardSize: MediaCardSize;
  readonly onNaturalSize: (width: number, height: number) => void;
} {
  const [cardSize, setCardSize] = useState<MediaCardSize>(() =>
    resolveStoredCardSize(kind, initialLayout)
  );
  const persistLayoutRef = useRef(persistLayout);
  persistLayoutRef.current = persistLayout;
  const lastPersistedRef = useRef<MediaCardSize | null>(
    initialLayout ? snapMediaCardSize(initialLayout) : null
  );

  const commitSize = useCallback((next: MediaCardSize) => {
    setCardSize((current) => (sameSize(current, next) ? current : next));
    const previous = lastPersistedRef.current;
    if (previous && sameSize(previous, next)) {
      return;
    }
    lastPersistedRef.current = next;
    persistLayoutRef.current?.(next);
  }, []);

  useEffect(() => {
    if (initialLayout) {
      const snapped = snapMediaCardSize(initialLayout);
      setCardSize(snapped);
      lastPersistedRef.current = snapped;
    }
  }, [initialLayout?.width, initialLayout?.height]);

  useEffect(() => {
    if (holdSize || hasMedia) {
      return;
    }
    setCardSize(resolveStoredCardSize(kind, initialLayout));
  }, [kind, hasMedia, mediaKey, holdSize, initialLayout]);

  const onNaturalSize = useCallback(
    (width: number, height: number) => {
      commitSize(computeMediaCardSize(width, height));
    },
    [commitSize]
  );

  return { cardSize, onNaturalSize };
}
