import { buildApiUrl } from "@/config/api";

export function isAuthenticatedApiMediaUrl(url: string): boolean {
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

function isPresignedTosMediaUrl(url: string): boolean {
  try {
    const target = new URL(url);
    return target.hostname.endsWith(".volces.com");
  } catch {
    return false;
  }
}

/** URLs the browser can fetch into IndexedDB (same-origin API or presigned TOS). */
export function mediaUrlSupportsBrowserCache(url: string): boolean {
  return isAuthenticatedApiMediaUrl(url) || isPresignedTosMediaUrl(url);
}

export function mediaFetchInitForCacheUrl(url: string): RequestInit {
  if (isPresignedTosMediaUrl(url)) {
    return { credentials: "omit" };
  }
  return { credentials: "include" };
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
