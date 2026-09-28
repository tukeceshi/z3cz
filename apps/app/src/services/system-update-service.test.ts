import { describe, expect, it } from "vitest";

import { isSystemUpdateAbortError } from "./system-update-service";

describe("isSystemUpdateAbortError", () => {
  it("recognizes abort and ignores other errors", () => {
    expect(
      isSystemUpdateAbortError(new DOMException("aborted", "AbortError"))
    ).toBe(true);
    expect(isSystemUpdateAbortError(new Error("已中止更新下载"))).toBe(true);
    expect(isSystemUpdateAbortError(new Error("上传失败"))).toBe(false);
  });
});
