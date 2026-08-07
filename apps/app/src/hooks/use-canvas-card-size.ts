import { useCallback, useEffect, useState } from "react";

import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  type MediaCardSize,
} from "@/components/workflow/media-card-size";

function emptyCardSize(kind: "image" | "video"): MediaCardSize {
  return kind === "video" ? AI_VIDEO_EMPTY_CARD_SIZE : AI_IMAGE_EMPTY_CARD_SIZE;
}

interface UseCanvasCardSizeParams {
  readonly kind: "image" | "video";
  readonly hasMedia: boolean;
  readonly mediaKey: string | null;
}

export function useCanvasCardSize({
  kind,
  hasMedia,
  mediaKey,
}: UseCanvasCardSizeParams): {
  readonly cardSize: MediaCardSize;
  readonly onNaturalSize: (width: number, height: number) => void;
} {
  const [cardSize, setCardSize] = useState<MediaCardSize>(() =>
    emptyCardSize(kind)
  );

  useEffect(() => {
    setCardSize(emptyCardSize(kind));
  }, [kind, hasMedia, mediaKey]);

  const onNaturalSize = useCallback((width: number, height: number) => {
    setCardSize((current) => {
      const next = computeMediaCardSize(width, height);
      if (current.width === next.width && current.height === next.height) {
        return current;
      }
      return next;
    });
  }, []);

  return { cardSize, onNaturalSize };
}
