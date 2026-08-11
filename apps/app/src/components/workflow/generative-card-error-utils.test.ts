import { describe, expect, it } from "vitest";

import {
  AI_IMAGE_GENERATE_ERROR_META_KEY,
  GENERATIVE_CARD_GENERATE_ERROR_META_KEY,
  readGenerativeCardError,
  stripTransientGenerativeMetadata,
  withGenerativeCardGenerateError,
} from "./generative-card-error-utils";

describe("generative-card-error-utils", () => {
  it("reads structured card errors with cardLines from metadata", () => {
    expect(
      readGenerativeCardError({
        [GENERATIVE_CARD_GENERATE_ERROR_META_KEY]: JSON.stringify({
          summary: "DeepSeek V4 Flash（文字）调用失败",
          cardLines: [
            "DeepSeek V4 Flash（文字）调用失败",
            "接口 「API」DeepSeek 请求失败，请检查配置或稍后重试。",
          ],
          detail: "完整错误",
        }),
      })?.cardLines
    ).toHaveLength(2);
  });

  it("normalizes legacy plain string metadata into card lines", () => {
    expect(
      readGenerativeCardError({
        [GENERATIVE_CARD_GENERATE_ERROR_META_KEY]: [
          "DeepSeek V4 Flash（文字）调用失败",
          "接口 「API」DeepSeek 请求失败，请检查配置或稍后重试。",
        ].join("\n"),
      })?.cardLines?.length
    ).toBeGreaterThan(0);
  });

  it("falls back to legacy image metadata key", () => {
    expect(
      readGenerativeCardError({
        [AI_IMAGE_GENERATE_ERROR_META_KEY]: "Legacy failure",
      })?.summary
    ).toBe("Legacy failure");
  });

  it("writes serialized structured errors", () => {
    expect(
      withGenerativeCardGenerateError(
        { [AI_IMAGE_GENERATE_ERROR_META_KEY]: "old" },
        {
          summary: "生成失败",
          cardLines: ["生成失败"],
          detail: "upstream unavailable",
        }
      )
    ).toEqual({
      [GENERATIVE_CARD_GENERATE_ERROR_META_KEY]: JSON.stringify({
        summary: "生成失败",
        cardLines: ["生成失败"],
        detail: "upstream unavailable",
      }),
    });
  });

  it("strips card errors and generating flags for persist/rehydrate", () => {
    expect(
      stripTransientGenerativeMetadata({
        [GENERATIVE_CARD_GENERATE_ERROR_META_KEY]: "403",
        [AI_IMAGE_GENERATE_ERROR_META_KEY]: "legacy",
        aiTextGenerating: "1",
        keepMe: "yes",
      })
    ).toEqual({ keepMe: "yes" });

    expect(
      stripTransientGenerativeMetadata({
        [GENERATIVE_CARD_GENERATE_ERROR_META_KEY]: "only-error",
      })
    ).toBeUndefined();
  });
});
