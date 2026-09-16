import { describe, expect, it } from "vitest";

import {
  clampCacheLimitMb,
  defaultLimitMbFromQuotaBytes,
  isQuotaExceededError,
  orderEntriesForEviction,
  pickQuickCleanWorkflowId,
  shouldShowCacheCleanupHint,
} from "./ai-media-cache-limit";

describe("defaultLimitMbFromQuotaBytes", () => {
  it("uses 70% of browser storage", () => {
    const tenGb = 10 * 1024 * 1024 * 1024;
    expect(defaultLimitMbFromQuotaBytes(tenGb)).toBe(7168);
  });

  it("returns null when quota is missing", () => {
    expect(defaultLimitMbFromQuotaBytes(null)).toBeNull();
    expect(defaultLimitMbFromQuotaBytes(0)).toBeNull();
  });
});

describe("clampCacheLimitMb", () => {
  it("caps at the 70% maximum", () => {
    expect(clampCacheLimitMb(9000, 7168)).toBe(7168);
  });

  it("keeps at least 1 MB", () => {
    expect(clampCacheLimitMb(0, 7168)).toBe(1);
  });
});

describe("shouldShowCacheCleanupHint", () => {
  it("shows at 60% of the limit", () => {
    expect(shouldShowCacheCleanupHint(60, 100)).toBe(true);
    expect(shouldShowCacheCleanupHint(59, 100)).toBe(false);
  });
});

describe("pickQuickCleanWorkflowId", () => {
  const workflows = [
    {
      workflowId: "current",
      updatedAt: "2026-01-01T00:00:00.000Z",
      totalBytes: 10,
    },
    {
      workflowId: "older",
      updatedAt: "2025-01-01T00:00:00.000Z",
      totalBytes: 20,
    },
    {
      workflowId: "newer",
      updatedAt: "2026-06-01T00:00:00.000Z",
      totalBytes: 30,
    },
  ];

  it("clears the oldest updated workflow except the current canvas", () => {
    expect(pickQuickCleanWorkflowId(workflows, "current")).toBe("older");
  });

  it("returns null when only the current workflow has cache", () => {
    expect(
      pickQuickCleanWorkflowId(
        [
          {
            workflowId: "current",
            updatedAt: "2026-01-01T00:00:00.000Z",
            totalBytes: 10,
          },
        ],
        "current"
      )
    ).toBeNull();
  });
});

describe("orderEntriesForEviction", () => {
  it("keeps the new resource and prefers unused chat first", () => {
    const ordered = orderEntriesForEviction(
      [
        {
          key: "new",
          nodeType: "ai-image",
          lastAccessAt: "2026-06-01T00:00:00.000Z",
        },
        {
          key: "chat",
          nodeType: "agent-chat",
          lastAccessAt: "2026-01-01T00:00:00.000Z",
        },
        {
          key: "old",
          nodeType: "ai-video",
          lastAccessAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      "new"
    );
    expect(ordered.map((entry) => entry.key)).toEqual(["chat", "old"]);
  });
});

describe("isQuotaExceededError", () => {
  it("detects browser storage full errors", () => {
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError(new Error("fail"))).toBe(false);
  });
});
