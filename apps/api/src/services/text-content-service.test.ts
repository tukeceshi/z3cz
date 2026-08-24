import { describe, expect, it } from "vitest";

import { isTextContentSaveConflict } from "./text-content-service";

describe("isTextContentSaveConflict", () => {
  it("detects conflict results", () => {
    expect(isTextContentSaveConflict({ conflict: true, dbSha256: "abc" })).toBe(
      true
    );
  });

  it("rejects saved and missing results", () => {
    expect(
      isTextContentSaveConflict({
        resourceId: "res-1",
        contentSha256: "a".repeat(64),
      })
    ).toBe(false);
    expect(isTextContentSaveConflict(null)).toBe(false);
  });
});
