import type { LibtvComparisonConfig } from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const COMPETITOR_VIDEO_PRICING_KEY = "/admin/competitor-video-pricing";

export function useAdminLibtvComparisonConfig() {
  const { data, error, isLoading, mutate } = useSWR(
    COMPETITOR_VIDEO_PRICING_KEY,
    () =>
      makeRequest<{ config: LibtvComparisonConfig }>(
        COMPETITOR_VIDEO_PRICING_KEY
      )
  );

  return {
    config: data?.config,
    configError: error,
    isConfigLoading: isLoading,
    refreshConfig: mutate,
  };
}

export async function updateAdminLibtvComparisonConfig(
  config: LibtvComparisonConfig
): Promise<{ config: LibtvComparisonConfig }> {
  return makeRequest<{ config: LibtvComparisonConfig }>(
    COMPETITOR_VIDEO_PRICING_KEY,
    {
      method: "PATCH",
      body: JSON.stringify({ config }),
    }
  );
}
