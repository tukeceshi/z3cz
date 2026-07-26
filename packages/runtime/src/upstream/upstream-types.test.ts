import { describe, expect, it } from "vitest";

import { resolvePollTimeout, upstreamPollContinuation } from "../upstream/upstream-types";

describe("upstream poll helpers", () => {
  it("creates upstream poll continuations with next poll time", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const continuation = upstreamPollContinuation({
      nodeId: "node-1",
      provider: "replicate",
      taskId: "pred-1",
      pollUrl: "https://api.replicate.com/v1/predictions/pred-1",
      pollIntervalMs: 10_000,
      timeoutAt: "2026-01-01T00:30:00.000Z",
      now,
    });

    expect(continuation.nextPollAt).toBe("2026-01-01T00:00:10.000Z");
  });

  it("detects timed out continuations", () => {
    const continuation = upstreamPollContinuation({
      nodeId: "node-1",
      provider: "replicate",
      taskId: "pred-2",
      pollUrl: "https://api.replicate.com/v1/predictions/pred-2",
      pollIntervalMs: 5000,
      timeoutAt: "2026-01-01T00:05:00.000Z",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    const timedOut = resolvePollTimeout(
      continuation,
      new Date("2026-01-01T00:05:01.000Z")
    );

    expect(timedOut?.status).toBe("failed");
  });
});
