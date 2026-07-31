import { describe, expect, it } from "vitest";

import {
  canGenerativeCardDoubleClickUpload,
  generativePromptWithinModelLimit,
  hasGenerativePrompt,
  normalizeGenerativeCardUploadFile,
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

describe("generativePromptWithinModelLimit", () => {
  it("ignores surrounding whitespace when comparing length", () => {
    expect(generativePromptWithinModelLimit("  abc  ", 3)).toBe(true);
    expect(generativePromptWithinModelLimit("  abcd  ", 3)).toBe(false);
    expect(generativePromptWithinModelLimit("", 600)).toBe(true);
  });
});

describe("normalizeGenerativeCardUploadFile image formats", () => {
  it("accepts png and jpeg only", () => {
    expect(
      normalizeGenerativeCardUploadFile(
        new File([""], "a.png", { type: "image/png" }),
        "image"
      )
    ).not.toBeNull();
    expect(
      normalizeGenerativeCardUploadFile(
        new File([""], "a.jpg", { type: "image/jpeg" }),
        "image"
      )
    ).not.toBeNull();
    expect(
      normalizeGenerativeCardUploadFile(
        new File([""], "a.webp", { type: "image/webp" }),
        "image"
      )
    ).toBeNull();
    expect(
      normalizeGenerativeCardUploadFile(
        new File([""], "a.gif", { type: "image/gif" }),
        "image"
      )
    ).toBeNull();
  });
});
