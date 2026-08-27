import { describe, expect, it } from "vitest";

import { resolveVideoCancelBranch } from "./generation-job";

describe("resolveVideoCancelBranch", () => {
  it("defers for missing or running upstream phase", () => {
    expect(
      resolveVideoCancelBranch({
        jobStatus: "generating",
        upstreamVideoStatus: undefined,
      })
    ).toBe("defer");
    expect(
      resolveVideoCancelBranch({
        jobStatus: "generating",
        upstreamVideoStatus: "running",
      })
    ).toBe("defer");
  });

  it("deletes immediately when upstream is queued", () => {
    expect(
      resolveVideoCancelBranch({
        jobStatus: "generating",
        upstreamVideoStatus: "queued",
      })
    ).toBe("delete_now");
  });

  it("blocks cancel for post-generation statuses", () => {
    expect(
      resolveVideoCancelBranch({
        jobStatus: "ready_to_persist",
        upstreamVideoStatus: "running",
      })
    ).toBe("blocked");
  });

  it("reports idempotent cancel states", () => {
    expect(
      resolveVideoCancelBranch({
        jobStatus: "cancelled",
        upstreamVideoStatus: "running",
      })
    ).toBe("already_cancelled");
    expect(
      resolveVideoCancelBranch({
        jobStatus: "cancelling",
        upstreamVideoStatus: "running",
      })
    ).toBe("already_cancelling");
  });
});
