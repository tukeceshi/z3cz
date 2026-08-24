import { describe, expect, it } from "vitest";

import { isStudioTextInlineEditorActive } from "./is-studio-text-inline-editor-active";

describe("isStudioTextInlineEditorActive", () => {
  it("does not mount an editor while browsing", () => {
    expect(isStudioTextInlineEditorActive(true, "table-1", "table-1")).toBe(
      false
    );
  });

  it("does not mount an editor until that segment is activated", () => {
    expect(isStudioTextInlineEditorActive(false, null, "table-1")).toBe(false);
    expect(isStudioTextInlineEditorActive(false, "table-2", "table-1")).toBe(
      false
    );
  });

  it("mounts only the activated segment", () => {
    expect(isStudioTextInlineEditorActive(false, "table-1", "table-1")).toBe(
      true
    );
  });
});
