import type { PublicVideoPriceEstimatesResponse } from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const PUBLIC_VIDEO_PRICE_ESTIMATES_KEY = "/video-price-estimates";

export function usePublicVideoPriceEstimates() {
  const { data, error, isLoading } = useSWR(
    PUBLIC_VIDEO_PRICE_ESTIMATES_KEY,
    () =>
      makeRequest<PublicVideoPriceEstimatesResponse>(
        PUBLIC_VIDEO_PRICE_ESTIMATES_KEY,
        {},
        true
      ),
    { revalidateOnFocus: false }
  );

  return {
    models: data?.models ?? [],
    competitors: data?.competitors ?? [],
    scenarios: data?.scenarios ?? [],
    estimatesError: error,
    isEstimatesLoading: isLoading,
  };
}
