import { describe, expect, it } from "vitest";

import {
  buildAiTextUserPrompt,
  buildOpenAiMultimodalUserContent,
  collectAiTextMediaReferences,
  validateAiTextPromptAssembly,
} from "./platform-ai-model";

describe("buildOpenAiMultimodalUserContent", () => {
  it("returns plain string when no media", () => {
    expect(
      buildOpenAiMultimodalUserContent({ prompt: "hello" })
    ).toBe("hello");
  });

  it("builds content parts with image and video urls", () => {
    expect(
      buildOpenAiMultimodalUserContent({
        prompt: "describe",
        referenceImageUrls: ["https://img.example/a.png"],
        referenceVideoUrls: ["https://vid.example/a.mp4"],
      })
    ).toEqual([
      {
        type: "video_url",
        video_url: { url: "https://vid.example/a.mp4" },
      },
      {
        type: "image_url",
        image_url: { url: "https://img.example/a.png" },
      },
      { type: "text", text: "describe" },
    ]);
  });
});

describe("buildAiTextUserPrompt with media", () => {
  it("uses default question when only media is present", () => {
    expect(
      buildAiTextUserPrompt({
        question: "",
        hasMediaReferences: true,
      })
    ).toBe("请根据以上内容回答。");
  });
});

describe("validateAiTextPromptAssembly with media", () => {
  it("accepts media-only input", () => {
    const result = validateAiTextPromptAssembly({
      question: "",
      parameterRules: {
        keywordsMaxChars: 1000,
        promptMaxChars: 1000,
      },
      mediaReferenceCount: 1,
    });
    expect(result.ok).toBe(true);
  });
});

describe("collectAiTextMediaReferences", () => {
  it("splits image and video media by mime type", () => {
    const result = collectAiTextMediaReferences([
      "text",
      {
        kind: "ephemeral",
        url: "https://img",
        mimeType: "image/png",
        mediaId: "i1",
      },
      {
        kind: "ephemeral",
        url: "https://vid",
        mimeType: "video/mp4",
        mediaId: "v1",
      },
    ]);
    expect(result.images).toHaveLength(1);
    expect(result.videos).toHaveLength(1);
  });
});
