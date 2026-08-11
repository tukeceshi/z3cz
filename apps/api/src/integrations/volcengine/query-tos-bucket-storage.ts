import type { VolcengineCredentials } from "./client";
import { callVolcengineMonitorApi } from "./monitor-client";

const TOS_MONITOR_NAMESPACE = "VCM_TOS" as const;
const TOS_BUCKET_OVERVIEW_SUBNAMESPACE = "bucket_overview" as const;
const TOS_BUCKET_TOTAL_STORAGE_METRIC = "BucketTotalStorage" as const;
const METRIC_LOOKBACK_SECONDS = 3600;
const METRIC_PERIOD = "300s" as const;

interface MetricDimension {
  readonly Name?: string;
  readonly Value?: string;
}

interface MetricInstance {
  readonly Dimensions?: readonly MetricDimension[];
}

interface MetricDataPoint {
  readonly Timestamp?: number;
  readonly Value?: number;
}

interface MetricDataResult {
  readonly MetricName?: string;
  readonly DataPoints?: readonly MetricDataPoint[];
}

interface GetMetricDataResult {
  readonly Data?: {
    readonly MetricDataResults?: readonly MetricDataResult[];
  };
}

export interface TosBucketStorageQueryResult {
  readonly storageGiB: number;
}

function parseMetricValue(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readLatestMetricDataPointGiB(
  result: GetMetricDataResult
): number | null {
  const dataPoints = result.Data?.MetricDataResults?.[0]?.DataPoints;
  if (!dataPoints?.length) {
    return null;
  }

  let latestTimestamp = -1;
  let latestValue: number | null = null;

  for (const point of dataPoints) {
    const value = parseMetricValue(point.Value);
    if (value === null) continue;

    const timestamp = point.Timestamp ?? 0;
    if (timestamp >= latestTimestamp) {
      latestTimestamp = timestamp;
      latestValue = value;
    }
  }

  return latestValue;
}

export async function queryTosBucketStorageGiB(params: {
  readonly credentials: VolcengineCredentials;
  readonly bucket: string;
  readonly region: string;
}): Promise<TosBucketStorageQueryResult | null> {
  const bucket = params.bucket.trim();
  if (!bucket) {
    return null;
  }

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - METRIC_LOOKBACK_SECONDS;

  const result = await callVolcengineMonitorApi<GetMetricDataResult>({
    credentials: params.credentials,
    action: "GetMetricData",
    region: params.region.trim() || undefined,
    body: {
      Namespace: TOS_MONITOR_NAMESPACE,
      SubNamespace: TOS_BUCKET_OVERVIEW_SUBNAMESPACE,
      MetricName: TOS_BUCKET_TOTAL_STORAGE_METRIC,
      StartTime: startTime,
      EndTime: endTime,
      Period: METRIC_PERIOD,
      Instances: [
        {
          Dimensions: [
            {
              Name: "ResourceID",
              Value: bucket,
            },
          ],
        } satisfies MetricInstance,
      ],
    },
  });

  const storageGiB = readLatestMetricDataPointGiB(result);
  if (storageGiB === null) {
    return null;
  }

  return { storageGiB };
}
