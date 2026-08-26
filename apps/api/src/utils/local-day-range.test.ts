import { describe, expect, it } from "vitest";

import {
  parseLocalDayEndExclusive,
  parseLocalDayRange,
  parseLocalDayStart,
} from "./local-day-range";

describe("parseLocalDayRange", () => {
  it("maps a local calendar day to UTC bounds (UTC+8)", () => {
    const range = parseLocalDayRange("2026-08-25", -480);
    expect(range).not.toBeNull();
    expect(range!.start.toISOString()).toBe("2026-08-24T16:00:00.000Z");
    expect(range!.end.toISOString()).toBe("2026-08-25T16:00:00.000Z");
  });

  it("exposes start and exclusive end helpers", () => {
    expect(parseLocalDayStart("2026-08-25", -480)?.toISOString()).toBe(
      "2026-08-24T16:00:00.000Z"
    );
    expect(parseLocalDayEndExclusive("2026-08-25", -480)?.toISOString()).toBe(
      "2026-08-25T16:00:00.000Z"
    );
  });

  it("returns null for invalid input", () => {
    expect(parseLocalDayRange("2026/08/25", -480)).toBeNull();
    expect(parseLocalDayRange("2026-08-25", Number.NaN)).toBeNull();
  });
});
