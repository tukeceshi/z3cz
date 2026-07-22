import { buildApiUrl } from "@/config/api";

function isAuthenticatedApiMediaUrl(url: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) {
      return false;
    }
    const path = target.pathname;
    return (
      path.includes("/objects") || path.includes("/platform-ai/media/proxy")
    );
  } catch {
    return false;
  }
}

/** Browser fetch + IndexedDB cache only works for same-origin API media URLs. */
export function mediaUrlSupportsBrowserCache(url: string): boolean {
  return isAuthenticatedApiMediaUrl(url);
}

export function buildMediaProxyEndpoint(
  organizationId: string,
  upstreamUrl: string,
  mimeType: string
): string {
  const query = new URLSearchParams({
    url: upstreamUrl,
    mimeType,
  });
  return buildApiUrl(
    `/${organizationId}/platform-ai/media/proxy?${query.toString()}`
  );
}
