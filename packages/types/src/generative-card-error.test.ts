import { describe, expect, it } from "vitest";

import {
  getGenerativeCardLines,
  normalizeGenerativeCardError,
  parseTextModelFailureMessageToCardError,
  serializeGenerativeCardError,
} from "./generative-card-error";

describe("generative-card-error", () => {
  it("parses text model failure copy into card lines", () => {
    const raw = [
      "DeepSeek V4 Flash（文字）调用失败",
      "接口 「API」DeepSeek 请求失败，请检查配置或稍后重试。",
      "解读：API Key 无效或已失效，请检查接口配置。",
      "Invalid API key",
    ].join("\n");

    const parsed = parseTextModelFailureMessageToCardError(raw);

    expect(parsed?.cardLines).toHaveLength(4);
    expect(parsed?.cardLines?.[3]).toBe("Invalid API key");
    expect(getGenerativeCardLines(parsed!)[0]).toBe(
      "DeepSeek V4 Flash（文字）调用失败"
    );
  });

  it("round-trips serialized card errors with cardLines", () => {
    const payload = serializeGenerativeCardError({
      summary: "DeepSeek V4 Flash（文字）调用失败",
      cardLines: [
        "DeepSeek V4 Flash（文字）调用失败",
        "接口 「API」DeepSeek 请求失败，请检查配置或稍后重试。",
      ],
      detail: "完整错误信息",
    });

    expect(normalizeGenerativeCardError(payload).cardLines).toHaveLength(2);
  });
});
