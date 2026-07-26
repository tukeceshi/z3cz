import { describe, expect, it } from "vitest";

import {
  blocksGenerativeMediaForHealth,
  CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD,
  type CloudStorageHealthSnapshot,
} from "./cloud-storage-health";

function snapshot(
  overrides: Partial<CloudStorageHealthSnapshot> = {}
): CloudStorageHealthSnapshot {
  return {
    status: "healthy",
    reason: null,
    message: null,
    checkedAt: new Date().toISOString(),
    interfaceId: "iface-1",
    bucket: "bucket-1",
    region: "cn-beijing",
    consecutiveFailureCount: 0,
    ...overrides,
  };
}

describe("blocksGenerativeMediaForHealth", () => {
  it("does not block when cloud storage is not configured", () => {
    expect(blocksGenerativeMediaForHealth(false, snapshot())).toBe(false);
  });

  it("blocks when health is unknown for configured orgs", () => {
    expect(blocksGenerativeMediaForHealth(true, null)).toBe(true);
  });

  it("allows degraded storage until failure threshold is reached", () => {
    expect(
      blocksGenerativeMediaForHealth(
        true,
        snapshot({
          status: "degraded",
          consecutiveFailureCount: CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD - 1,
        })
      )
    ).toBe(false);

    expect(
      blocksGenerativeMediaForHealth(
        true,
        snapshot({
          status: "degraded",
          consecutiveFailureCount: CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD,
        })
      )
    ).toBe(true);
  });

  it("blocks immediately for blocked status", () => {
    expect(
      blocksGenerativeMediaForHealth(
        true,
        snapshot({ status: "blocked", reason: "quota_exceeded" })
      )
    ).toBe(true);
  });
});
