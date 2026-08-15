import { describe, expect, it, vi } from "vitest";

import { runAfterResponse } from "./run-after-response";

describe("runAfterResponse", () => {
  it("uses waitUntil when present", () => {
    const work = Promise.resolve();
    const waitUntil = vi.fn();
    runAfterResponse({ waitUntil }, work);
    expect(waitUntil).toHaveBeenCalledWith(work);
  });

  it("does not throw when waitUntil is missing", () => {
    expect(() => runAfterResponse({}, Promise.resolve())).not.toThrow();
    expect(() => runAfterResponse(undefined, Promise.resolve())).not.toThrow();
  });
});
