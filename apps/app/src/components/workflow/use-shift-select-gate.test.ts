import { describe, expect, it } from "vitest";

import {
  isTypingTarget,
  shouldBlockCardInteraction,
} from "./use-shift-select-gate";

describe("shouldBlockCardInteraction", () => {
  it("blocks while Shift is held", () => {
    expect(shouldBlockCardInteraction(true, 0)).toBe(true);
    expect(shouldBlockCardInteraction(true, 1)).toBe(true);
  });

  it("blocks while multiple nodes stay selected", () => {
    expect(shouldBlockCardInteraction(false, 2)).toBe(true);
    expect(shouldBlockCardInteraction(false, 3)).toBe(true);
  });

  it("does not block for idle or single selection without Shift", () => {
    expect(shouldBlockCardInteraction(false, 0)).toBe(false);
    expect(shouldBlockCardInteraction(false, 1)).toBe(false);
  });
});

describe("isTypingTarget", () => {
  it("ignores Shift inside text fields", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as EventTarget)).toBe(true);
    expect(
      isTypingTarget({ tagName: "DIV", isContentEditable: true } as EventTarget)
    ).toBe(true);
  });

  it("treats the canvas as not typing", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ tagName: "DIV" } as EventTarget)).toBe(false);
  });
});
