import { describe, expect, it } from "vitest";

import {
  shouldShowGenerativeBottomPanel,
  shouldShowGenerativeHistoryIcon,
  withGenerativeCardEditing,
  withGenerativeGeneratedContentMode,
  withGenerativeManualContentMode,
} from "./generative-card-mode-utils";

describe("generative-card-mode-utils", () => {
  it("hides history icon for manual content or fewer than two generations", () => {
    expect(shouldShowGenerativeHistoryIcon(0, undefined)).toBe(false);
    expect(shouldShowGenerativeHistoryIcon(1, undefined)).toBe(false);
    expect(shouldShowGenerativeHistoryIcon(2, undefined)).toBe(true);
    expect(
      shouldShowGenerativeHistoryIcon(3, withGenerativeManualContentMode(undefined))
    ).toBe(false);
  });

  it("hides bottom panel only in manual content mode", () => {
    expect(shouldShowGenerativeBottomPanel(undefined)).toBe(true);
    expect(
      shouldShowGenerativeBottomPanel(withGenerativeManualContentMode(undefined))
    ).toBe(false);
    expect(
      shouldShowGenerativeBottomPanel(withGenerativeCardEditing(undefined, true))
    ).toBe(true);
  });

  it("clears manual-only metadata to undefined (must not fall back with ??)", () => {
    const manual = withGenerativeManualContentMode(undefined);
    expect(withGenerativeGeneratedContentMode(manual)).toBeUndefined();
    expect(withGenerativeGeneratedContentMode(manual) ?? manual).toEqual(manual);
  });
});
