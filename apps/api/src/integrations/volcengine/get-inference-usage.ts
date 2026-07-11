import type { VolcanoParsedInferenceUsage } from "./parse-inference-usage";
import { callVolcengineArkApi, type VolcengineCredentials } from "./client";
import { VOLCANO_DEFAULT_PROJECT_NAME } from "./constants";
import { parseVolcanoInferenceUsageRaw } from "./parse-inference-usage";

export const VOLCANO_USAGE_QUERY_INTERVAL = "Day" as const;
export const VOLCANO_USAGE_LOOKBACK_DAYS = 29;

export function formatVolcanoUsageDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildUsageRequestWindow(): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - VOLCANO_USAGE_LOOKBACK_DAYS);
  return {
    startTime: formatVolcanoUsageDate(start),
    endTime: formatVolcanoUsageDate(now),
  };
}

/** Single account-level GetInferenceUsage call; free/paid split parsed from rows. */
export async function fetchVolcanoInferenceUsageOnce(
  credentials: VolcengineCredentials
): Promise<VolcanoParsedInferenceUsage> {
  const { startTime, endTime } = buildUsageRequestWindow();

  const raw = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "GetInferenceUsage",
    body: {
      StartTime: startTime,
      EndTime: endTime,
      QueryInterval: VOLCANO_USAGE_QUERY_INTERVAL,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
  });

  return parseVolcanoInferenceUsageRaw(raw);
}
