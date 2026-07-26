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
      "已自动关闭错误接口 「API」DeepSeek。",
      "请检查配置，可在「AI/资源 接口」重新启用接口。",
      "重试将使用接口「聚合」火山方舟。",
      "Invalid API key",
    ].join("\n");

    const parsed = parseTextModelFailureMessageToCardError(raw);

    expect(parsed?.cardLines).toHaveLength(5);
    expect(parsed?.cardLines?.[4]).toBe("Invalid API key");
    expect(getGenerativeCardLines(parsed!)[0]).toBe(
      "DeepSeek V4 Flash（文字）调用失败"
    );
  });

  it("round-trips serialized card errors with cardLines", () => {
    const payload = serializeGenerativeCardError({
      summary: "DeepSeek V4 Flash（文字）调用失败",
      cardLines: [
        "DeepSeek V4 Flash（文字）调用失败",
        "已自动关闭错误接口 「API」DeepSeek。",
      ],
      detail: "完整错误信息",
    });

    expect(normalizeGenerativeCardError(payload).cardLines).toHaveLength(2);
  });
});
