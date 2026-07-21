const THUMB_MAX_WIDTH = 200;
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

export async function generateImageThumbnail(
  blob: Blob,
  mimeType?: string
): Promise<Blob | null> {
  const resolvedType = resolveImageMimeType(blob, mimeType);
  if (!resolvedType) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImageBitmap(blob, resolvedType);
  } catch {
    return null;
  }

  const width =
    bitmap.width <= THUMB_MAX_WIDTH ? bitmap.width : THUMB_MAX_WIDTH;
  const height =
    bitmap.width <= THUMB_MAX_WIDTH
      ? bitmap.height
      : Math.round((bitmap.height * THUMB_MAX_WIDTH) / bitmap.width);

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
