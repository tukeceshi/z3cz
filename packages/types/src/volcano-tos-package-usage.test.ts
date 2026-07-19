import { describe, expect, it } from "vitest";

import {
  buildTosPackageUsageFromRows,
  isTosStorageResourcePackage,
  isTosTrafficResourcePackage,
} from "./volcano-tos-package-usage";

describe("volcano-tos-package-usage", () => {
  it("classifies GiB storage packs separately from API request packs", () => {
    const storageRow = {
      ConfigurationCode: "standard_storage_10GiB",
      ConfigurationName: "对象存储 10GiB 标准存储资源包",
      Product: "TOS",
      Unit: "GiB",
      TotalAmount: "10",
      AvailableAmount: "10",
      Status: "Effective",
    };
    const requestRow = {
      ConfigurationCode: "standard_storage_API_Requests_20",
      ConfigurationName: "对象存储 20万次 标准存储API请求资源包",
      Product: "TOS",
      Unit: "万次",
      TotalAmount: "20",
      AvailableAmount: "20",
      Status: "Effective",
    };

    expect(isTosStorageResourcePackage(storageRow)).toBe(true);
    expect(isTosStorageResourcePackage(requestRow)).toBe(false);
  });

  it("aggregates storage and traffic packs without mixed-unit errors", () => {
    const rows = [
      {
        ConfigurationCode: "standard_storage_10GiB",
        ConfigurationName: "对象存储 10GiB 标准存储资源包",
        Product: "TOS",
        Unit: "GiB",
        TotalAmount: "10",
        AvailableAmount: "8",
        Status: "Effective",
      },
      {
        ConfigurationCode: "standard_storage_API_Requests_20",
        ConfigurationName: "对象存储 20万次 标准存储API请求资源包",
        Product: "TOS",
        Unit: "万次",
        TotalAmount: "20",
        AvailableAmount: "20",
        Status: "Effective",
      },
      {
        ConfigurationCode: "traffic_cost_busy_time_10GB",
        ConfigurationName: "对象存储 10GB 公网流出流量资源包",
        Product: "TOS",
        Unit: "GB",
        TotalAmount: "10",
        AvailableAmount: "6",
        Status: "Effective",
      },
    ] as const;

    const aggregated = buildTosPackageUsageFromRows(rows);

    expect(isTosTrafficResourcePackage(rows[2])).toBe(true);
    expect(aggregated.storageUsage).toMatchObject({
      quota: 10,
      remaining: 8,
      unit: "gb",
    });
    expect(aggregated.trafficUsage).toMatchObject({
      quota: 10,
      remaining: 6,
      unit: "gb",
    });
  });
});
