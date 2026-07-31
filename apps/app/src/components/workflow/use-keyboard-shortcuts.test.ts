import { describe, expect, it, vi } from "vitest";

import { hasDomTextSelection } from "./use-keyboard-shortcuts";

function mockSelection(params: {
  readonly collapsed: boolean;
  readonly rangeCount: number;
  readonly text: string;
}): Selection {
  return {
    isCollapsed: params.collapsed,
    rangeCount: params.rangeCount,
    toString: () => params.text,
  } as Selection;
}

describe("hasDomTextSelection", () => {
  it("returns false for null or collapsed selection", () => {
    expect(hasDomTextSelection(null)).toBe(false);
    expect(
      hasDomTextSelection(
        mockSelection({ collapsed: true, rangeCount: 1, text: "x" })
      )
    ).toBe(false);
  });

  it("returns false when there is no range or empty text", () => {
    expect(
      hasDomTextSelection(
        mockSelection({ collapsed: false, rangeCount: 0, text: "x" })
      )
    ).toBe(false);
    expect(
      hasDomTextSelection(
        mockSelection({ collapsed: false, rangeCount: 1, text: "" })
      )
    ).toBe(false);
  });

  it("returns true for a non-empty text selection", () => {
    expect(
      hasDomTextSelection(
        mockSelection({ collapsed: false, rangeCount: 1, text: "hello" })
      )
    ).toBe(true);
  });

  it("defaults to window.getSelection when no argument is passed", () => {
    const spy = vi.spyOn(window, "getSelection").mockReturnValue(
      mockSelection({ collapsed: false, rangeCount: 1, text: "studio" })
    );
    expect(hasDomTextSelection()).toBe(true);
    spy.mockRestore();
  });
});
