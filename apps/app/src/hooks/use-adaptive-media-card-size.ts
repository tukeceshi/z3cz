import { useEffect, useState } from "react";

import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  type MediaCardSize,
} from "@/components/workflow/media-card-size";

export function useAdaptiveMediaCardSize(params: {
  readonly displayUrl: string | null;
  readonly hasMedia: boolean;
  readonly kind: "image" | "video";
}): MediaCardSize {
  const emptySize =
    params.kind === "video" ? AI_VIDEO_EMPTY_CARD_SIZE : AI_IMAGE_EMPTY_CARD_SIZE;
  const [naturalSize, setNaturalSize] = useState<{
    readonly width: number;
    readonly height: number;
  } | null>(null);

  useEffect(() => {
    if (!params.hasMedia || !params.displayUrl) {
      setNaturalSize(null);
      return;
    }

    let cancelled = false;

    if (params.kind === "image") {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setNaturalSize({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => {
        if (!cancelled) setNaturalSize(null);
      };
      image.src = params.displayUrl;
      return () => {
        cancelled = true;
        image.onload = null;
        image.onerror = null;
      };
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    const handleLoaded = () => {
      if (cancelled) return;
      setNaturalSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    const handleError = () => {
      if (!cancelled) setNaturalSize(null);
    };
    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("error", handleError);
    video.src = params.displayUrl;
    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
      video.src = "";
    };
  }, [params.displayUrl, params.hasMedia, params.kind]);

  if (!params.hasMedia || !naturalSize) {
    return emptySize;
  }

  return computeMediaCardSize(naturalSize.width, naturalSize.height);
}
