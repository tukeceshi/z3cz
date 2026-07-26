import { describe, expect, it } from "vitest";

import { buildApiKeyHint, readApiKeyHint, withApiKeyHint } from "./api-key-hint";

describe("api-key-hint", () => {
  it("builds head-tail hint for long keys", () => {
    expect(buildApiKeyHint("sk-abcdefghijklmnop")).toBe("sk-a…mnop");
  });

  it("masks short keys", () => {
    expect(buildApiKeyHint("short")).toBe("••••••••");
  });

  it("reads hint from metadata", () => {
    expect(readApiKeyHint({ apiKeyHint: "sk-a…mnop" })).toBe("sk-a…mnop");
  });

  it("merges hint into metadata", () => {
    expect(
      withApiKeyHint({ channel: "single-model" }, "sk-abcdefghijklmnop")
    ).toEqual({
      channel: "single-model",
      apiKeyHint: "sk-a…mnop",
    });
  });
});
