import { describe, expect, it } from "vitest";

import {
  formatVideoTrimPromptExcerpt,
  isSubmitVideoTrimRangeValid,
  normalizeSubmitVideoTrimRange,
} from "./video-trim-mediakit";

describe("video-trim-mediakit", () => {
  it("normalizes trim range to 0.1s steps", () => {
    expect(
      normalizeSubmitVideoTrimRange({ startSec: 1.04, endSec: 5.06 })
    ).toEqual({ startSec: 1, endSec: 5.1 });
  });

  it("validates minimum trim duration", () => {
    expect(isSubmitVideoTrimRangeValid({ startSec: 0, endSec: 0.1 })).toBe(true);
    expect(isSubmitVideoTrimRangeValid({ startSec: 0, endSec: 0.05 })).toBe(
      false
    );
    expect(isSubmitVideoTrimRangeValid({ startSec: -1, endSec: 2 })).toBe(
      false
    );
  });

  it("formats prompt excerpt", () => {
    expect(formatVideoTrimPromptExcerpt({ startSec: 1, endSec: 5.1 })).toBe(
      "1.0s – 5.1s"
    );
  });
});
