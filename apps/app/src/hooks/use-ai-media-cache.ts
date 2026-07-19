import { useCallback, useEffect, useState } from "react";

import {
  getAiMediaCacheStats,
  type AiMediaCacheStats,
} from "@/services/ai-media-cache-service";

const CACHE_STATS_EVENT = "dafthunk:ai-media-cache-changed";

export function notifyAiMediaCacheChanged(): void {
  window.dispatchEvent(new CustomEvent(CACHE_STATS_EVENT));
}

export function useAiMediaCacheStats(organizationId: string | undefined) {
  const [stats, setStats] = useState<AiMediaCacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setStats(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const next = await getAiMediaCacheStats(organizationId);
      setStats(next);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener(CACHE_STATS_EVENT, handler);
    return () => window.removeEventListener(CACHE_STATS_EVENT, handler);
  }, [refresh]);

  return { stats, isLoading, refresh };
}
