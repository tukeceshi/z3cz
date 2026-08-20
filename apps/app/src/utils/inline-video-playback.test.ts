import { describe, expect, it, vi } from "vitest";

import {
  applyInlineVideoPlayback,
  canHoverVideoPlayback,
  startMutedInlinePlayback,
} from "./inline-video-playback";

function createFakeVideo(): HTMLVideoElement {
  const attributes = new Map<string, string>();
  return {
    playsInline: false,
    muted: false,
    play: () => Promise.resolve(),
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  } as HTMLVideoElement;
}

describe("inline-video-playback", () => {
  it("detects fine hover pointers", () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes("hover: hover") && query.includes("pointer: fine"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMedia);

    expect(canHoverVideoPlayback()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("starts playback muted and inline", () => {
    const video = createFakeVideo();
    startMutedInlinePlayback(video);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.getAttribute("webkit-playsinline")).toBe("true");
  });

  it("marks a video for inline playback", () => {
    const video = createFakeVideo();
    applyInlineVideoPlayback(video);
    expect(video.getAttribute("playsinline")).toBe("");
  });
});
