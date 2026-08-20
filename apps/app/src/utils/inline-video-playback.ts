export function canHoverVideoPlayback(): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function applyInlineVideoPlayback(video: HTMLVideoElement): void {
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "true");
}

export function startMutedInlinePlayback(video: HTMLVideoElement): void {
  applyInlineVideoPlayback(video);
  video.muted = true;
  void video.play().catch(() => undefined);
}
