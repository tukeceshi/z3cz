import type { GetNodeTypesResponse, NodeType } from "@dafthunk/types";
import { useMemo } from "react";
import useSWR, { mutate, type SWRConfiguration } from "swr";

import { useTranslation } from "@/components/locale-provider";
import { localizeNodeTypes } from "@/lib/node-i18n";

import { makeRequest } from "./utils";

// Base endpoint for node types - now public
const API_ENDPOINT_BASE = "/types";

export function prefetchNodeTypes(schemeId?: string): void {
  const swrKey = schemeId
    ? `${API_ENDPOINT_BASE}?schemeId=${encodeURIComponent(schemeId)}`
    : API_ENDPOINT_BASE;

  void mutate(swrKey, async () => {
    const query = schemeId ? `?schemeId=${encodeURIComponent(schemeId)}` : "";
    const response = await makeRequest<GetNodeTypesResponse>(
      `${API_ENDPOINT_BASE}${query}`
    );
    return response.nodeTypes;
  });
}

export interface UseNodeTypes {
  nodeTypes: NodeType[];
  nodeTypesError: Error | null;
  isNodeTypesLoading: boolean;
  mutateNodeTypes: () => Promise<any>;
}

export interface UseNodeTypesOptions extends SWRConfiguration<NodeType[]> {
  readonly enabled?: boolean;
}

/**
 * Hook to fetch available node types (now public endpoint)
 */
export const useNodeTypes = (
  schemeId?: string,
  options?: UseNodeTypesOptions
): UseNodeTypes => {
  const { locale } = useTranslation();
  const { enabled = true, ...swrOptions } = options ?? {};
  const swrKey = schemeId
    ? `${API_ENDPOINT_BASE}?schemeId=${encodeURIComponent(schemeId)}`
    : API_ENDPOINT_BASE;

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? swrKey : null,
    async () => {
      const query = schemeId
        ? `?schemeId=${encodeURIComponent(schemeId)}`
        : "";
      const response = await makeRequest<GetNodeTypesResponse>(
        `${API_ENDPOINT_BASE}${query}`
      );
      return response.nodeTypes;
    },
    swrOptions
  );

  const nodeTypes = useMemo(
    () => localizeNodeTypes(data || [], locale),
    [data, locale]
  );

  return {
    nodeTypes,
    nodeTypesError: error || null,
    isNodeTypesLoading: isLoading,
    mutateNodeTypes: mutate,
  };
};
