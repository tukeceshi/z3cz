import { describe, expect, it } from "vitest";

import {
  extractGenerativeErrorMessage,
  generativeModelKindFromNodeType,
  matchGenerativeErrorRule,
  readRealPersonReferenceLabels,
  ruleAppliesToModelKind,
} from "./generative-error-rules";
import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "./ai-interface";

describe("extractGenerativeErrorMessage", () => {
  it("strips upstream HTTP wrapper and parses JSON message", () => {
    expect(
      extractGenerativeErrorMessage(
        'Upstream request failed (402): {"error":{"message":"余额不足"}}'
      )
    ).toBe("余额不足");
  });

  it("strips Error: prefix", () => {
    expect(extractGenerativeErrorMessage("Error: Invalid API key")).toBe(
      "Invalid API key"
    );
  });
});

describe("matchGenerativeErrorRule", () => {
  it("matches balance errors for image models", () => {
    expect(
      matchGenerativeErrorRule({
        raw: "余额不足",
        modelKind: "image",
      })?.id
    ).toBe("balance");
  });

  it("matches auth errors for text models", () => {
    expect(
      matchGenerativeErrorRule({
        raw: "Invalid API key",
        modelKind: "text",
      })?.id
    ).toBe("auth");
  });

  it("does not match prompt rules for audio", () => {
    expect(
      matchGenerativeErrorRule({
        raw: "prompt is required",
        modelKind: "audio",
      })
    ).toBeUndefined();
  });

  it("matches cloud upload for audio only among media kinds", () => {
    expect(
      matchGenerativeErrorRule({
        raw: "cloud upload failed",
        modelKind: "audio",
      })?.id
    ).toBe("cloudUpload");
    expect(
      matchGenerativeErrorRule({
        raw: "cloud upload failed",
        modelKind: "text",
      })
    ).toBeUndefined();
  });

  it("returns english copy when requested", () => {
    expect(
      matchGenerativeErrorRule({
        raw: "Invalid API key",
        modelKind: "video",
        locale: "en",
      })?.message
    ).toContain("API Key");
  });

  it("formats real-person video rejections with reference index", () => {
    const raw =
      "The request failed because the input image 'content[1]' may contain real person.";
    const matched = matchGenerativeErrorRule({
      raw,
      modelKind: "video",
      locale: "zh",
    });

    expect(matched?.id).toBe("realPersonInReference");
    expect(matched?.cardLines).toEqual([
      "参考[图1]包含真人图像，生成被拒绝",
      "可将图片转为 彩绘、手绘 尝试生成",
    ]);
  });

  it("formats multiple cited content indices in one real-person error", () => {
    const raw =
      'The request failed because the input image \'content[1]\' \'content[2]\' may contain real person.';
    const matched = matchGenerativeErrorRule({
      raw,
      modelKind: "video",
      locale: "zh",
    });

    expect(readRealPersonReferenceLabels(raw, "zh")).toBe("图1、图2");
    expect(matched?.cardLines?.[0]).toBe(
      "参考[图1、图2]包含真人图像，生成被拒绝"
    );
  });

  it("parses real-person errors from JSON response excerpts", () => {
    const raw =
      '{"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The request failed because the input image \'content[1]\' \'content[2]\' may contain real person."}}';
    expect(readRealPersonReferenceLabels(raw, "zh")).toBe("图1、图2");
  });

  it("does not match real-person errors for image models", () => {
    expect(
      matchGenerativeErrorRule({
        raw: "may contain real person",
        modelKind: "image",
      })
    ).toBeUndefined();
  });
});

describe("generativeModelKindFromNodeType", () => {
  it("maps workflow node types", () => {
    expect(generativeModelKindFromNodeType(AI_TEXT_NODE_TYPE)).toBe("text");
    expect(generativeModelKindFromNodeType(AI_IMAGE_NODE_TYPE)).toBe("image");
    expect(generativeModelKindFromNodeType(AI_VIDEO_NODE_TYPE)).toBe("video");
    expect(generativeModelKindFromNodeType(AI_AUDIO_NODE_TYPE)).toBe("audio");
  });
});

describe("ruleAppliesToModelKind", () => {
  it("treats all as universal", () => {
    expect(ruleAppliesToModelKind("all", "audio")).toBe(true);
  });
});
