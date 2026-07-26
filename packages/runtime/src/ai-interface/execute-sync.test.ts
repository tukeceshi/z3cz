import { describe, expect, it } from "vitest";

import { resolveSyncRequestUrl } from "./execute-sync";

describe("resolveSyncRequestUrl", () => {
  it("appends path when base URL has no path suffix", () => {
    expect(
      resolveSyncRequestUrl(
        "https://ark.cn-beijing.volces.com/api/v3",
        "/chat/completions"
      )
    ).toBe("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  });

  it("uses base URL as-is when it already ends with the path", () => {
    expect(
      resolveSyncRequestUrl(
        "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        "/chat/completions"
      )
    ).toBe("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  });
});
