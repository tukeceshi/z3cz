import { describe, expect, it } from "vitest";

import { readLatestMetricDataPointGiB } from "./query-tos-bucket-storage";

describe("readLatestMetricDataPointGiB", () => {
  it("returns the latest data point value", () => {
    const value = readLatestMetricDataPointGiB({
      Data: {
        MetricDataResults: [
          {
            MetricName: "BucketTotalStorage",
            DataPoints: [
              { Timestamp: 100, Value: 0.2 },
              { Timestamp: 200, Value: 0.48 },
            ],
          },
        ],
      },
    });

    expect(value).toBe(0.48);
  });

  it("returns null when no data points exist", () => {
    expect(readLatestMetricDataPointGiB({ MetricDataResults: [] })).toBeNull();
    expect(readLatestMetricDataPointGiB({})).toBeNull();
  });
});
