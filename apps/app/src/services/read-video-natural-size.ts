export async function readVideoNaturalSize(
  blob: Blob
): Promise<{ readonly width: number; readonly height: number } | null> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to read video metadata"));
      video.src = url;
    });

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null;
    }

    return { width: video.videoWidth, height: video.videoHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
