import { CANVAS_TIER_SHORT_EDGE } from "@/services/canvas-media-tier";

const DEFAULT_THUMB_SHORT_EDGE = CANVAS_TIER_SHORT_EDGE.s;
const THUMB_JPEG_QUALITY = 0.75;

function resolveImageMimeType(blob: Blob, mimeType?: string): string | null {
  const fromBlob = blob.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (fromBlob.startsWith("image/")) return fromBlob;

  const fromMeta = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (fromMeta.startsWith("image/")) return fromMeta;

  return null;
}

async function loadImageBitmap(blob: Blob, mimeType: string): Promise<ImageBitmap> {
  if (blob.type === mimeType) {
    return createImageBitmap(blob);
  }

  const typedBlob = new Blob([blob], { type: mimeType });
  try {
    return await createImageBitmap(typedBlob);
  } catch {
    return createImageBitmap(
      new Blob([await typedBlob.arrayBuffer()], { type: mimeType })
    );
  }
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

export async function generateImageThumbnail(
  blob: Blob,
  mimeType?: string,
  maxShortEdge: number = DEFAULT_THUMB_SHORT_EDGE
): Promise<Blob | null> {
  const resolvedType = resolveImageMimeType(blob, mimeType);
  if (!resolvedType) return null;

  const targetShortEdge =
    Number.isFinite(maxShortEdge) && maxShortEdge > 0
      ? maxShortEdge
      : DEFAULT_THUMB_SHORT_EDGE;

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImageBitmap(blob, resolvedType);
  } catch {
    return null;
  }

  const { width, height } = scaleToShortEdge(
    bitmap.width,
    bitmap.height,
    targetShortEdge
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      "image/jpeg",
      THUMB_JPEG_QUALITY
    );
  });
}

export async function readImageNaturalSize(
  blob: Blob,
  mimeType?: string
): Promise<{ readonly width: number; readonly height: number } | null> {
  const resolvedType = resolveImageMimeType(blob, mimeType);
  if (!resolvedType) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImageBitmap(blob, resolvedType);
  } catch {
    return null;
  }

  const size = {
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  return size;
}
