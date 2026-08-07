import { CANVAS_TIER_SHORT_EDGE } from "@/services/canvas-media-tier";

const DEFAULT_POSTER_SHORT_EDGE = CANVAS_TIER_SHORT_EDGE.s;
const POSTER_JPEG_QUALITY = 0.75;

function loadVideoMetadata(
  blob: Blob
): Promise<{
  readonly video: HTMLVideoElement;
  readonly width: number;
  readonly height: number;
  readonly objectUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const handleLoaded = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        video.src = "";
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Video poster: missing dimensions"));
        return;
      }
      resolve({ video, width, height, objectUrl });
    };

    const handleError = () => {
      video.src = "";
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Video poster: failed to load"));
    };

    video.addEventListener("loadeddata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.src = objectUrl;
  });
}

function scaleToShortEdge(
  naturalWidth: number,
  naturalHeight: number,
  maxShortEdge: number
): { readonly width: number; readonly height: number } {
  const short = Math.min(naturalWidth, naturalHeight);
  if (short <= maxShortEdge) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const scale = maxShortEdge / short;
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

export async function generateVideoPoster(
  blob: Blob,
  maxShortEdge: number
): Promise<Blob | null> {
  const targetShortEdge =
    Number.isFinite(maxShortEdge) && maxShortEdge > 0
      ? maxShortEdge
      : DEFAULT_POSTER_SHORT_EDGE;

  let loaded: Awaited<ReturnType<typeof loadVideoMetadata>>;
  try {
    loaded = await loadVideoMetadata(blob);
  } catch {
    return null;
  }

  const { video, width: naturalWidth, height: naturalHeight, objectUrl } =
    loaded;

  const { width: drawWidth, height: drawHeight } = scaleToShortEdge(
    naturalWidth,
    naturalHeight,
    targetShortEdge
  );

  const canvas = document.createElement("canvas");
  canvas.width = drawWidth;
  canvas.height = drawHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    video.src = "";
    URL.revokeObjectURL(objectUrl);
    return null;
  }

  try {
    ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
  } catch {
    video.src = "";
    URL.revokeObjectURL(objectUrl);
    return null;
  }

  video.src = "";
  URL.revokeObjectURL(objectUrl);

  return new Promise((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      "image/jpeg",
      POSTER_JPEG_QUALITY
    );
  });
}
