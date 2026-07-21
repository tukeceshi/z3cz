import { describe, expect, it } from "vitest";

import {
  canGenerativeCardDoubleClickUpload,
  hasGenerativePrompt,
  readGenerativePrompt,
  withGenerativePromptCleared,
} from "./generative-card-upload-utils";

describe("canGenerativeCardDoubleClickUpload", () => {
  it("allows upload only on an empty idle card", () => {
    expect(
      canGenerativeCardDoubleClickUpload({
        hasMedia: false,
        isGenerating: false,
      })
    ).toBe(true);
    expect(
      canGenerativeCardDoubleClickUpload({
        hasMedia: true,
        isGenerating: false,
      })
    ).toBe(false);
    expect(
      canGenerativeCardDoubleClickUpload({
        hasMedia: false,
        isGenerating: true,
      })
    ).toBe(false);
  });
});

describe("generative prompt helpers", () => {
  it("reads and clears prompt input", () => {
    const inputs = [
      { id: "prompt", name: "prompt", type: "string" as const, value: "hello" },
    ];

    expect(readGenerativePrompt(inputs)).toBe("hello");
    expect(hasGenerativePrompt("  hi ")).toBe(true);
    expect(hasGenerativePrompt("   ")).toBe(false);
    expect(withGenerativePromptCleared(inputs)[0]?.value).toBe("");
  });
});
