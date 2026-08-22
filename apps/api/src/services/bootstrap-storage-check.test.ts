import { describe, expect, it } from "vitest";

import { formatBootstrapBucketContentWarning } from "./bootstrap-storage-check";

describe("bootstrap-storage-check", () => {
  it("returns null when bucket only contains acceleration objects", () => {
    expect(formatBootstrapBucketContentWarning(0)).toBeNull();
  });

  it("warns when foreign objects exist", () => {
    expect(formatBootstrapBucketContentWarning(2)).toContain("2");
  });
});
