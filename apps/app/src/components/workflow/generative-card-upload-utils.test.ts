import { describe, expect, it } from "vitest";

import { resolveGenerativeStudioDropFile } from "./generative-card-upload-utils";

describe("resolveGenerativeStudioDropFile", () => {
  it("resolves image files", () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    expect(resolveGenerativeStudioDropFile(file)).toMatchObject({
      kind: "image",
      nodeType: "ai-image",
    });
  });

  it("resolves video files", () => {
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    expect(resolveGenerativeStudioDropFile(file)).toMatchObject({
      kind: "video",
      nodeType: "ai-video",
    });
  });

  it("resolves audio files", () => {
    const file = new File(["x"], "track.mp3", { type: "audio/mpeg" });
    expect(resolveGenerativeStudioDropFile(file)).toMatchObject({
      kind: "audio",
      nodeType: "ai-audio",
    });
  });

  it("rejects unsupported files", () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    expect(resolveGenerativeStudioDropFile(file)).toBeNull();
  });
});
