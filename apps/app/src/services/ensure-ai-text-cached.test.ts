import { describe, expect, it } from "vitest";

import {
  isEmptyLocalText,
  isLocalTextTrustedForSync,
} from "./ensure-ai-text-cached";

describe("ensure-ai-text-cached local trust", () => {
  it("treats empty body as untrusted for first hydrate", () => {
    expect(isEmptyLocalText("")).toBe(true);
    expect(isEmptyLocalText("   ")).toBe(true);
    expect(isEmptyLocalText("hello")).toBe(false);
  });

  it("empty local is never trusted even when workflow sha exists", async () => {
    await expect(
      isLocalTextTrustedForSync("", "a".repeat(64))
    ).resolves.toBe(false);
  });

  it("non-empty local without workflow sha is trusted", async () => {
    await expect(isLocalTextTrustedForSync("hello", undefined)).resolves.toBe(
      true
    );
  });

  it("local sha must match workflow sha to be trusted", async () => {
    const text = "stable text";
    const { sha256HexFromText } = await import("@/utils/text-content-utils");
    const sha = await sha256HexFromText(text);

    await expect(isLocalTextTrustedForSync(text, sha)).resolves.toBe(true);
    await expect(isLocalTextTrustedForSync("wrong", sha)).resolves.toBe(false);
  });
});
