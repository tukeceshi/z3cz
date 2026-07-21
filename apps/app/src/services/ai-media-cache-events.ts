const CACHE_STATS_EVENT = "dafthunk:ai-media-cache-changed";

export function notifyAiMediaCacheChanged(): void {
  window.dispatchEvent(new CustomEvent(CACHE_STATS_EVENT));
}

export { CACHE_STATS_EVENT };
