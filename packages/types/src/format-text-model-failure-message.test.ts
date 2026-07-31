import { describe, expect, it } from "vitest";

import {
  buildTextModelFailureCardParts,
  buildTextModelInvocationErrorFromFailure,
  formatTextModelFailureMessage,
} from "./format-text-model-failure-message";
import {
  buildTextModelInvocationError,
  extractUpstreamErrorMessage,
  interpretUpstreamTextModelError,
  isTransientTextModelUpstreamError,
} from "./interpret-upstream-text-model-error";

describe("extractUpstreamErrorMessage", () => {
  it("parses JSON error message from upstream HTTP wrapper", () => {
    expect(
      extractUpstreamErrorMessage(
        'Upstream request failed (402): {"error":{"message":"余额不足"}}'
      )
    ).toBe("余额不足");
  });
});

describe("interpretUpstreamTextModelError", () => {
  it("interprets balance errors", () => {
    expect(interpretUpstreamTextModelError("余额不足")).toContain("余额不足");
  });

  it("interprets invalid api key", () => {
    expect(interpretUpstreamTextModelError("Invalid API key")).toContain(
      "API Key"
    );
  });
});

describe("isTransientTextModelUpstreamError", () => {
  it("treats abort/timeout as transient", () => {
    expect(isTransientTextModelUpstreamError("This operation was aborted")).toBe(
      true
    );
    expect(isTransientTextModelUpstreamError("请求超时")).toBe(true);
  });

  it("treats auth errors as permanent", () => {
    expect(isTransientTextModelUpstreamError("Invalid API key")).toBe(false);
  });
});

describe("buildTextModelInvocationError", () => {
  it("includes interpretation and raw upstream only", () => {
    const message = buildTextModelInvocationError({
      upstreamError: "余额不足",
    });

    expect(message).toContain("解读：");
    expect(message).toContain("余额不足");
    expect(message).not.toContain("重试将使用接口");
    expect(message).not.toContain("已自动关闭错误接口");
  });
});

describe("formatTextModelFailureMessage", () => {
  it("uses the four-line card template with upstream reason", () => {
    const message = formatTextModelFailureMessage({
      failedInterfaceName: "DeepSeek",
      channelKind: "api",
      modelDisplayLabel: "DeepSeek V4 Flash（文字）",
      upstreamError: "Invalid API key",
      nextInterfaceName: "火山引擎-火山方舟-字节跳动旗下",
      nextChannelKind: "aggregate",
      locale: "zh",
    });

    expect(message).toContain("DeepSeek V4 Flash（文字）调用失败");
    expect(message).toContain("已自动关闭错误接口 「API」DeepSeek。");
    expect(message).toContain("请检查配置，可在「AI/资源 接口」重新启用接口。");
    expect(message).toContain(
      "重试将使用接口「聚合」火山引擎-火山方舟-字节跳动旗下。"
    );
    expect(message).toContain("解读：");
    expect(message).toContain("Invalid API key");
    expect(message).not.toContain("原因：");
  });

  it("states no other interfaces when next is absent", () => {
    const message = formatTextModelFailureMessage({
      failedInterfaceName: "火山方舟",
      channelKind: "aggregate",
      modelDisplayLabel: "DeepSeek V4 Pro（文字）",
      locale: "zh",
    });

    expect(message).toContain("已无其他可用接口。");
    expect(message).not.toContain("重试将使用接口");
  });
});

describe("buildTextModelFailureCardParts", () => {
  it("returns card lines with interpretation and upstream reason", () => {
    const parts = buildTextModelFailureCardParts({
      failedInterfaceName: "DeepSeek",
      channelKind: "api",
      modelDisplayLabel: "DeepSeek V4 Flash（文字）",
      upstreamError: "Invalid API key",
      nextInterfaceName: "火山引擎-火山方舟-字节跳动旗下",
      nextChannelKind: "aggregate",
      locale: "zh",
    });

    expect(parts.cardLines).toEqual([
      "DeepSeek V4 Flash（文字）调用失败",
      "已自动关闭错误接口 「API」DeepSeek。",
      "请检查配置，可在「AI/资源 接口」重新启用接口。",
      "重试将使用接口「聚合」火山引擎-火山方舟-字节跳动旗下。",
      "解读：API Key 无效或已失效，请检查接口配置。",
      "Invalid API key",
    ]);
    expect(parts.detail).toContain("Invalid API key");
  });
});

describe("buildTextModelInvocationErrorFromFailure", () => {
  it("omits card retry hints for invocation logs", () => {
    const message = buildTextModelInvocationErrorFromFailure({
      upstreamError:
        'Upstream request failed (402): {"error":{"message":"余额不足"}}',
    });

    expect(message).toContain("解读：");
    expect(message).toContain("余额不足");
    expect(message).not.toContain("重试将使用接口");
    expect(message).not.toContain("调用失败");
  });
});
