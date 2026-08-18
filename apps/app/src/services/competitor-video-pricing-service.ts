import type {
  LibtvComparisonConfig,
  PublicVideoPriceEstimatesResponse,
  VideoPriceCompetitor,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const COMPETITOR_VIDEO_PRICING_KEY = "/admin/competitor-video-pricing";

export function useAdminVideoPriceCompetitors() {
  const { data, error, isLoading, mutate } = useSWR(
    COMPETITOR_VIDEO_PRICING_KEY,
    () =>
      makeRequest<{ competitors: readonly VideoPriceCompetitor[] }>(
        COMPETITOR_VIDEO_PRICING_KEY
      )
  );

  return {
    competitors: data?.competitors ?? [],
    competitorsError: error,
    isCompetitorsLoading: isLoading,
    refreshCompetitors: mutate,
  };
}

export async function addAdminVideoPriceCompetitor(
  input:
    | {
        readonly kind: "compare";
        readonly name: string;
        readonly config: LibtvComparisonConfig;
        readonly showUrl: boolean;
        readonly url: string;
      }
    | {
        readonly kind: "promoNote";
        readonly name: string;
        readonly text: string;
        readonly showDates: boolean;
        readonly startsAt: string;
        readonly endsAt: string;
        readonly showUrl: boolean;
        readonly url: string;
      }
): Promise<{ competitor: VideoPriceCompetitor }> {
  return makeRequest<{ competitor: VideoPriceCompetitor }>(
    COMPETITOR_VIDEO_PRICING_KEY,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function updateAdminVideoPriceCompetitor(input: {
  readonly competitorId: string;
  readonly name?: string;
  readonly config?: LibtvComparisonConfig;
  readonly text?: string;
  readonly showDates?: boolean;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly showUrl?: boolean;
  readonly url?: string;
}): Promise<{ competitor: VideoPriceCompetitor }> {
  return makeRequest<{ competitor: VideoPriceCompetitor }>(
    COMPETITOR_VIDEO_PRICING_KEY,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function deleteAdminVideoPriceCompetitor(
  competitorId: string
): Promise<{ ok: true }> {
  return makeRequest<{ ok: true }>(COMPETITOR_VIDEO_PRICING_KEY, {
    method: "DELETE",
    body: JSON.stringify({ competitorId }),
  });
}

export async function cacheAdminHomepageVideoPrices(): Promise<PublicVideoPriceEstimatesResponse> {
  return makeRequest<PublicVideoPriceEstimatesResponse>(
    `${COMPETITOR_VIDEO_PRICING_KEY}/cache`,
    {
      method: "POST",
    }
  );
}
