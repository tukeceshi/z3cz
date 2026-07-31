import { describe, expect, it } from "vitest";

import {
  shouldShowStudioPromptBox,
  studioDockSizeForPanel,
} from "./generative-studio-dock-layout";

describe("shouldShowStudioPromptBox", () => {
  it("always shows prompt outside studio dock", () => {
    expect(
      shouldShowStudioPromptBox({
        layout: "attached",
        hasPromptReference: false,
        allowUpload: true,
        referenceChips: [{ kind: "image" }],
      })
    ).toBe(true);
  });

  it("hides prompt for upload-only media refs in studio dock", () => {
    expect(
      shouldShowStudioPromptBox({
        layout: "studio-dock",
        hasPromptReference: false,
        allowUpload: true,
        referenceChips: [{ kind: "image" }],
      })
    ).toBe(false);
  });

  it("shows prompt when text reference exists", () => {
    expect(
      shouldShowStudioPromptBox({
        layout: "studio-dock",
        hasPromptReference: false,
        allowUpload: true,
        referenceChips: [{ kind: "image" }, { kind: "text" }],
      })
    ).toBe(true);
  });
});

describe("studioDockSizeForPanel", () => {
  it("returns compact when prompt is shown in studio dock", () => {
    expect(
      studioDockSizeForPanel({
        layout: "studio-dock",
        hasPromptReference: false,
        allowUpload: true,
        referenceChips: [{ kind: "text" }],
      })
    ).toBe("compact");
  });

  it("returns expanded for upload-only media refs", () => {
    expect(
      studioDockSizeForPanel({
        layout: "studio-dock",
        hasPromptReference: false,
        allowUpload: true,
        referenceChips: [{ kind: "image" }],
      })
    ).toBe("expanded");
  });
});
