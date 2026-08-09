import { describe, expect, it } from "vitest";

import { readStudioMediaCardState } from "./studio-media-card-state";

describe("readStudioMediaCardState", () => {
  it("returns upload placeholder when idle", () => {
    const state = readStudioMediaCardState(undefined, false);
    expect(state.placeholderKey).toBe(
      "workflow.aiImagePanel.cardUploadPlaceholder"
    );
    expect(state.isBusy).toBe(false);
    expect(state.generateError).toBeUndefined();
  });

  it("returns generating key when image is generating", () => {
    const state = readStudioMediaCardState(
      { aiImageGenerating: "1" },
      false
    );
    expect(state.placeholderKey).toBe(
      "workflow.aiImagePanel.cardGenerating"
    );
    expect(state.isBusy).toBe(true);
  });

  it("treats image cancelled phase as busy (canvas-aligned)", () => {
    const state = readStudioMediaCardState(
      { genProgressPhase: "cancelled" },
      false
    );
    expect(state.placeholderKey).toBe(
      "workflow.aiImagePanel.cardCancelled"
    );
    expect(state.isBusy).toBe(true);
  });

  it("returns progress phase key for video upload", () => {
    const state = readStudioMediaCardState(
      { genProgressPhase: "uploading" },
      true
    );
    expect(state.placeholderKey).toBe(
      "workflow.aiVideoPanel.cardUploading"
    );
    expect(state.isBusy).toBe(true);
  });

  it("treats video cancelled phase as idle (canvas-aligned)", () => {
    const state = readStudioMediaCardState(
      { genProgressPhase: "cancelled" },
      true
    );
    expect(state.isBusy).toBe(false);
  });
});
