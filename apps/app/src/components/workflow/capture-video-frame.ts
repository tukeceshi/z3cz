export type VideoFrameCaptureMode = "first" | "last" | "current";

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked"
): Promise<void> {
  if (eventName === "loadedmetadata" && video.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video failed to load"));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onSuccess);
      video.removeEventListener("error", onError);
    };

    video.addEventListener(eventName, onSuccess, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function resolveCaptureTime(
  video: HTMLVideoElement,
  mode: VideoFrameCaptureMode
): number {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  if (mode === "first") {
    return 0;
  }
  if (mode === "last") {
    return Math.max(0, duration - 0.05);
  }
  return Math.min(Math.max(0, video.currentTime), duration);
}

export function formatVideoFrameSuffix(
  mode: VideoFrameCaptureMode,
  currentTimeSeconds: number
): string {
  if (mode === "first") {
    return "首帧";
  }
  if (mode === "last") {
    return "尾帧";
  }
  const seconds = Math.max(0, Math.round(currentTimeSeconds));
  return `${seconds}秒帧`;
}

export async function captureVideoFrameBlob(
  video: HTMLVideoElement,
  mode: VideoFrameCaptureMode
): Promise<{ readonly blob: Blob; readonly capturedAtSeconds: number }> {
  await waitForVideoEvent(video, "loadedmetadata");

  const targetTime = resolveCaptureTime(video, mode);
  if (Math.abs(video.currentTime - targetTime) > 0.01) {
    video.currentTime = targetTime;
    await waitForVideoEvent(video, "seeked");
  }

  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width <= 0 || height <= 0) {
    throw new Error("Video dimensions unavailable");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable");
  }

  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Failed to encode frame"));
      },
      "image/jpeg",
      0.92
    );
  });

  return { blob, capturedAtSeconds: targetTime };
}

export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
