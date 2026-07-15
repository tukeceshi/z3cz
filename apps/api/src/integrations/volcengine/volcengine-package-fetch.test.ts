import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VOLCANO_RESOURCE_PACKAGE_EXTENDED_STATUSES,
  VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES,
  volcanoResourcePackageStatusesForMode,
} from "@dafthunk/types";

import { callVolcengineBillingApi } from "./billing-client";
import { fetchVolcanoResourcePackages } from "./list-resource-packages";
import {
  buildPackageListCache,
  isPackageListCacheFresh,
  VOLCANO_PACKAGE_LIST_CACHE_TTL_MS,
} from "./package-list-cache";
import type { VolcanoResourcePackageRow } from "./parse-resource-packages";
import { resolveVolcanoPackageRows } from "./resolve-package-rows";

vi.mock("./billing-client", () => ({
  callVolcengineBillingApi: vi.fn(),
}));

const credentials = {
  accessKeyId: "ak-test",
  secretAccessKey: "sk-test",
};

const effectiveRow: VolcanoResourcePackageRow = {
  ConfigurationCode: "pkg-a",
  TotalAmount: "100",
  AvailableAmount: "80",
  Status: "Effective",
  InstanceNo: "inst-effective",
};

const usedUpRow: VolcanoResourcePackageRow = {
  ConfigurationCode: "pkg-b",
  TotalAmount: "50",
  AvailableAmount: "0",
  Status: "UsedUp",
  InstanceNo: "inst-used",
};

describe("volcanoResourcePackageStatusesForMode", () => {
  it("returns metering statuses by default", () => {
    expect(volcanoResourcePackageStatusesForMode("metering")).toEqual(
      VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES
    );
  });

  it("includes extended statuses in full mode", () => {
    const full = volcanoResourcePackageStatusesForMode("full");
    for (const status of VOLCANO_RESOURCE_PACKAGE_EXTENDED_STATUSES) {
      expect(full).toContain(status);
    }
    expect(full.length).toBe(
      VOLCANO_RESOURCE_PACKAGE_METERING_STATUSES.length +
        VOLCANO_RESOURCE_PACKAGE_EXTENDED_STATUSES.length
    );
  });
});

describe("package list cache", () => {
  it("treats cache within TTL as fresh", () => {
    const now = Date.parse("2026-07-13T12:00:00.000Z");
    const cache = buildPackageListCache({
      mode: "metering",
      rows: [effectiveRow],
      statusCounts: { Effective: 1 },
      fetchedAt: "2026-07-13T11:55:00.000Z",
    });

    expect(isPackageListCacheFresh(cache, now)).toBe(true);
  });

  it("treats cache past TTL as stale", () => {
    const now = Date.parse("2026-07-13T12:00:00.000Z");
    const cache = buildPackageListCache({
      mode: "metering",
      rows: [effectiveRow],
      statusCounts: { Effective: 1 },
      fetchedAt: new Date(
        now - VOLCANO_PACKAGE_LIST_CACHE_TTL_MS - 1
      ).toISOString(),
    });

    expect(isPackageListCacheFresh(cache, now)).toBe(false);
  });
});

describe("fetchVolcanoResourcePackages", () => {
  beforeEach(() => {
    vi.mocked(callVolcengineBillingApi).mockReset();
  });

  it("fetches metering statuses in parallel and merges by instance", async () => {
    vi.mocked(callVolcengineBillingApi).mockImplementation(async ({ body }) => {
      const status = (body as { Status?: string }).Status;
      if (status === "Effective") {
        return { List: [effectiveRow] };
      }
      if (status === "UsedUp") {
        return { List: [usedUpRow] };
      }
      return { List: [] };
    });

    const result = await fetchVolcanoResourcePackages({ credentials });

    expect(result.rows).toHaveLength(2);
    expect(result.statusCounts.Effective).toBe(1);
    expect(result.statusCounts.UsedUp).toBe(1);
    expect(result.partialErrors).toHaveLength(0);
    expect(callVolcengineBillingApi).toHaveBeenCalledTimes(3);
  });

  it("returns partial rows when one status fetch fails", async () => {
    vi.mocked(callVolcengineBillingApi).mockImplementation(async ({ body }) => {
      const status = (body as { Status?: string }).Status;
      if (status === "Effective") {
        return { List: [effectiveRow] };
      }
      if (status === "UsedUp") {
        throw new Error("rate limited");
      }
      return { List: [] };
    });

    const result = await fetchVolcanoResourcePackages({ credentials });

    expect(result.rows).toHaveLength(1);
    expect(result.partialErrors).toEqual([
      "Status=UsedUp: rate limited",
    ]);
  });

  it("throws when every status fetch fails", async () => {
    vi.mocked(callVolcengineBillingApi).mockRejectedValue(
      new Error("billing unavailable")
    );

    await expect(
      fetchVolcanoResourcePackages({ credentials })
    ).rejects.toThrow("billing unavailable");
  });
});

describe("resolveVolcanoPackageRows", () => {
  beforeEach(() => {
    vi.mocked(callVolcengineBillingApi).mockReset();
  });

  const baseMetadata = {
    credentialMode: "volcengine_iam" as const,
    accessKeyId: "ak",
    secretAccessKeyEncrypted: "enc",
    arkApiKeyDurationSeconds: 3600,
    region: "cn-beijing",
    models: {},
  };

  it("returns cached rows when cache is fresh and refresh is false", async () => {
    const cached = buildPackageListCache({
      mode: "metering",
      rows: [effectiveRow],
      statusCounts: { Effective: 1 },
      fetchedAt: new Date().toISOString(),
    });

    const result = await resolveVolcanoPackageRows({
      credentials,
      metadata: { ...baseMetadata, packageListCache: cached },
      refreshPackages: false,
    });

    expect(result.rows).toEqual([effectiveRow]);
    expect(callVolcengineBillingApi).not.toHaveBeenCalled();
  });

  it("falls back to stale cache when live fetch fails", async () => {
    const staleFetchedAt = new Date(
      Date.now() - VOLCANO_PACKAGE_LIST_CACHE_TTL_MS - 60_000
    ).toISOString();
    const cached = buildPackageListCache({
      mode: "metering",
      rows: [effectiveRow],
      statusCounts: { Effective: 1 },
      fetchedAt: staleFetchedAt,
    });

    vi.mocked(callVolcengineBillingApi).mockRejectedValue(
      new Error("network down")
    );

    const result = await resolveVolcanoPackageRows({
      credentials,
      metadata: { ...baseMetadata, packageListCache: cached },
      refreshPackages: true,
    });

    expect(result.rows).toEqual([effectiveRow]);
    expect(result.usageFetchError).toContain("Using cached package data");
    expect(result.usageFetchError).toContain("network down");
  });
});
