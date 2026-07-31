import { useEffect, useState } from "react";

import { videoSrcAllowsCrossOrigin } from "./video-src-cross-origin";

interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

const imageDimensionsCache = new Map<string, ImageDimensions>();
const mediaDurationCache = new Map<string, number>();

function applyCrossOriginIfAllowed(
  element: HTMLImageElement | HTMLMediaElement,
  src: string
): void {
  if (videoSrcAllowsCrossOrigin(src)) {
    element.crossOrigin = "anonymous";
  }
}

export function formatStudioImageDimensions(
  width: number,
  height: number
): string {
  return `${width} x ${height}`;
}

export function formatStudioVideoDurationLabel(seconds: number): string {
  const wholeSeconds = Math.max(1, Math.round(seconds));
  return `${wholeSeconds}s`;
}

export function probeImageDimensions(src: string): Promise<ImageDimensions> {
  const cached = imageDimensionsCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    applyCrossOriginIfAllowed(image, src);

    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        const dimensions: ImageDimensions = {
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
        imageDimensionsCache.set(src, dimensions);
        resolve(dimensions);
        return;
      }
      reject(new Error("Invalid image dimensions"));
    };

    image.onerror = () => {
      reject(new Error("Failed to load image metadata"));
    };

    image.src = src;
  });
}

export function probeMediaDuration(
  src: string,
  kind: "audio" | "video"
): Promise<number> {
  const cached = mediaDurationCache.get(src);
  if (cached != null) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const media = document.createElement(kind);
    media.preload = "metadata";
    applyCrossOriginIfAllowed(media, src);

    const finish = () => {
      if (Number.isFinite(media.duration) && media.duration > 0) {
        mediaDurationCache.set(src, media.duration);
        resolve(media.duration);
        return;
      }
      reject(new Error("Invalid media duration"));
    };

    media.addEventListener("loadedmetadata", finish);
    media.addEventListener("durationchange", finish);
    media.addEventListener("error", () => {
      reject(new Error("Failed to load media metadata"));
    });

    media.src = src;
  });
}

export function useStudioImageFileSize(
  src: string | null | undefined
): string | null {
  const [sizeLabel, setSizeLabel] = useState<string | null>(() => {
    if (!src) return null;
    const cached = imageDimensionsCache.get(src);
    return cached
      ? formatStudioImageDimensions(cached.width, cached.height)
      : null;
  });

  useEffect(() => {
    if (!src) {
      setSizeLabel(null);
      return;
    }

    const cached = imageDimensionsCache.get(src);
    if (cached) {
      setSizeLabel(formatStudioImageDimensions(cached.width, cached.height));
      return;
    }

    let cancelled = false;

    void probeImageDimensions(src)
      .then((dimensions) => {
        if (cancelled) return;
        setSizeLabel(
          formatStudioImageDimensions(dimensions.width, dimensions.height)
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSizeLabel(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return sizeLabel;
}

export function useStudioVideoFileDuration(
  src: string | null | undefined
): string | null {
  const [durationLabel, setDurationLabel] = useState<string | null>(() => {
    if (!src) return null;
    const cached = mediaDurationCache.get(src);
    return cached != null ? formatStudioVideoDurationLabel(cached) : null;
  });

  useEffect(() => {
    if (!src) {
      setDurationLabel(null);
      return;
    }

    const cached = mediaDurationCache.get(src);
    if (cached != null) {
      setDurationLabel(formatStudioVideoDurationLabel(cached));
      return;
    }

    let cancelled = false;

    void probeMediaDuration(src, "video")
      .then((duration) => {
        if (cancelled) return;
        setDurationLabel(formatStudioVideoDurationLabel(duration));
      })
      .catch(() => {
        if (!cancelled) {
          setDurationLabel(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return durationLabel;
}

export function useStudioAudioFileDuration(
  src: string | null | undefined
): number | null {
  const [duration, setDuration] = useState<number | null>(() => {
    if (!src) return null;
    return mediaDurationCache.get(src) ?? null;
  });

  useEffect(() => {
    if (!src) {
      setDuration(null);
      return;
    }

    const cached = mediaDurationCache.get(src);
    if (cached != null) {
      setDuration(cached);
      return;
    }

    let cancelled = false;

    void probeMediaDuration(src, "audio")
      .then((value) => {
        if (!cancelled) {
          setDuration(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDuration(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return duration;
}
